import { describe, expect, it } from 'vitest';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import { SITE_LOCALE } from '@/content/site-locale';

const EN_OVERVIEW_ID = 'fact-overview-stack';

describe('the long overview answer is graded in pt-BR as well as English', () => {
  it('mirrors the English overview item with a pt locale and the same key facts', () => {
    const english = ASK_EVAL_CORPUS.find((item) => item.id === EN_OVERVIEW_ID);
    const portuguese = ASK_EVAL_CORPUS.filter(
      (item) =>
        item.locale === SITE_LOCALE.pt &&
        item.kind === 'factual' &&
        english?.facts !== undefined &&
        item.facts?.join() === english.facts.join(),
    );
    expect(english).toBeDefined();
    expect(
      portuguese,
      'the pt-BR path of the longest answer the prompt allows goes ungraded, so a truncation there is invisible',
    ).toHaveLength(1);
    expect(portuguese[0]?.question).toMatch(/^Quem é o Erik\?$/);
  });
});
