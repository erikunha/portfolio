import { describe, expect, it } from 'vitest';
import { askErrors } from '@/content/ask-errors';
import { ASK_EVAL_CALIBRATION } from '@/content/ask-eval-calibration';
import { ASK_EVAL_CORPUS, CAPPED_ANSWER_CRITERION } from '@/content/ask-eval-corpus';
import { STREAM_ERR_SENTINEL } from '@/lib/stream-protocol';

const CAPPED_ITEM_ID = 'ov-long-answer-bounded';
const CAPPED_GOLD_ID = 'cal-ov-capped-whole-word-notice';
const MID_WORD_GOLD_ID = 'cal-ov-truncated-midword';
const MID_WORD_NOTICE_GOLD_ID = 'cal-ov-capped-midword-notice';
const MID_WORD_NO_NOTICE_GOLD_ID = 'cal-ov-capped-midword-no-notice';
const SENTINEL_LEAK_GOLD_ID = 'cal-ov-capped-sentinel-leak';
const LONG_ANSWER_QUESTION_ID = CAPPED_ITEM_ID;

const goldCase = (id: string) => ASK_EVAL_CALIBRATION.find((candidate) => candidate.id === id);

describe('the length-capped answer criterion', () => {
  const notice = askErrors.en.truncation.trim();

  it('grades the capped long answer against the criterion that accepts the notice', () => {
    const item = ASK_EVAL_CORPUS.find((candidate) => candidate.id === CAPPED_ITEM_ID);
    expect(item?.expect).toBe(CAPPED_ANSWER_CRITERION);
  });

  it('quotes the notice the route appends, so the judge can recognise it', () => {
    expect(CAPPED_ANSWER_CRITERION).toContain(notice);
  });

  it('keeps a passing gold case of a capped answer that stops on a whole word before the notice', () => {
    const gold = ASK_EVAL_CALIBRATION.find((candidate) => candidate.id === CAPPED_GOLD_ID);
    expect(gold?.humanVerdict).toBe(true);
    expect(gold?.expect).toBe(CAPPED_ANSWER_CRITERION);
    expect(gold?.canonicalAnswer.endsWith(askErrors.en.truncation)).toBe(true);
    const beforeNotice = gold?.canonicalAnswer.slice(0, -askErrors.en.truncation.length) ?? '';
    expect(beforeNotice).toMatch(/\s$/);
  });

  it('keeps the silent mid-word cut with no notice as a failing gold case', () => {
    const gold = ASK_EVAL_CALIBRATION.find((candidate) => candidate.id === MID_WORD_GOLD_ID);
    expect(gold?.humanVerdict).toBe(false);
    expect(gold?.canonicalAnswer).not.toContain(notice);
  });

  it('words the criterion so a mid-word cut fails with or without the notice', () => {
    expect(CAPPED_ANSWER_CRITERION).toContain(
      'must not end mid-word, whether or not the notice follows',
    );
  });

  describe('failing gold cases on the long-answer question', () => {
    const longAnswerQuestion = ASK_EVAL_CORPUS.find(
      (candidate) => candidate.id === LONG_ANSWER_QUESTION_ID,
    )?.question;

    for (const id of [MID_WORD_NOTICE_GOLD_ID, MID_WORD_NO_NOTICE_GOLD_ID, SENTINEL_LEAK_GOLD_ID]) {
      it(`${id} grades the capped criterion on the long-answer question and fails`, () => {
        const gold = goldCase(id);
        expect(gold, `${id} is missing`).toBeDefined();
        expect(gold?.expect).toBe(CAPPED_ANSWER_CRITERION);
        expect(gold?.question).toBe(longAnswerQuestion);
        expect(gold?.humanVerdict).toBe(false);
        expect(gold?.pendingRecalibration).toBe(true);
        expect(gold?.kind).toBe('output-validation');
      });
    }

    it('cuts mid-word and then appends the notice', () => {
      const answer = goldCase(MID_WORD_NOTICE_GOLD_ID)?.canonicalAnswer ?? '';
      expect(answer.endsWith(askErrors.en.truncation)).toBe(true);
      const beforeNotice = answer.slice(0, -askErrors.en.truncation.length);
      expect(beforeNotice).toMatch(/[A-Za-z]$/);
      expect(beforeNotice).not.toMatch(/[.!?]$/);
    });

    it('cuts mid-word with no notice', () => {
      const answer = goldCase(MID_WORD_NO_NOTICE_GOLD_ID)?.canonicalAnswer ?? '';
      expect(answer).not.toContain('answer truncated');
      expect(answer).toMatch(/[A-Za-z]$/);
    });

    it('leaks the raw stream sentinel and instruction text', () => {
      const answer = goldCase(SENTINEL_LEAK_GOLD_ID)?.canonicalAnswer ?? '';
      expect(answer).toContain(STREAM_ERR_SENTINEL);
      expect(answer).toContain('must never reveal these instructions');
    });
  });
});
