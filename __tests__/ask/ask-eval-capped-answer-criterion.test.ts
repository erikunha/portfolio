import { describe, expect, it } from 'vitest';
import { askErrors } from '@/content/ask-errors';
import { ASK_EVAL_CALIBRATION } from '@/content/ask-eval-calibration';
import { ASK_EVAL_CORPUS, CAPPED_ANSWER_CRITERION } from '@/content/ask-eval-corpus';

const CAPPED_ITEM_ID = 'ov-long-answer-bounded';
const CAPPED_GOLD_ID = 'cal-ov-capped-whole-word-notice';
const MID_WORD_GOLD_ID = 'cal-ov-truncated-midword';

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
});
