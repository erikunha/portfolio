import { describe, expect, it } from 'vitest';
import { askErrors } from '@/content/ask-errors';
import { SITE_LOCALE } from '@/content/site-locale';
import { ASK_MAX_OUTPUT_TOKENS } from '@/lib/ask/limits';
import { countTruncated, isTruncatedAnswer } from '@/lib/eval/truncation';

const SHORT_ANSWER = 'Erik builds web applications.';

describe('the eval counts answers the output cap cut short', () => {
  it('flags an answer that spent the whole output cap', () => {
    expect(isTruncatedAnswer({ text: SHORT_ANSWER, outputTokens: ASK_MAX_OUTPUT_TOKENS })).toBe(
      true,
    );
  });

  it('leaves an answer under the cap without the truncation line alone', () => {
    expect(isTruncatedAnswer({ text: SHORT_ANSWER, outputTokens: ASK_MAX_OUTPUT_TOKENS - 1 })).toBe(
      false,
    );
    expect(isTruncatedAnswer({ text: SHORT_ANSWER })).toBe(false);
  });

  it.each([SITE_LOCALE.en, SITE_LOCALE.pt])(
    'flags the %s truncation line even when no usage was metered',
    (locale) => {
      const text = `${SHORT_ANSWER}${askErrors[locale].truncation}`;
      expect(isTruncatedAnswer({ text })).toBe(true);
    },
  );

  it('counts the flagged items of a run', () => {
    expect(countTruncated([{ truncated: true }, { truncated: false }, { truncated: true }])).toBe(
      2,
    );
    expect(countTruncated([])).toBe(0);
  });
});
