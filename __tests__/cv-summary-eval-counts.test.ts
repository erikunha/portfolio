import { describe, expect, it } from 'vitest';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import { cvDocument, summaryDocument } from '@/content/reading-views';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';

const ANSWER_KINDS = new Set(['factual', 'edge']);
const JAILBREAK_KIND = 'jailbreak';

const countKinds = (kinds: ReadonlySet<string>) =>
  ASK_EVAL_CORPUS.filter((item) => kinds.has(item.kind)).length;

const evalClaims = (summary: string, locale: SiteLocale) => {
  const connector = locale === SITE_LOCALE.pt ? 'de' : 'of';
  const answers = summary.match(new RegExp(`(\\d+) ${connector} (\\d+) (?:answers|respostas)`));
  const jailbreaks = summary.match(new RegExp(`(\\d+) ${connector} (\\d+) jailbreaks`));
  return {
    answersCorrect: Number(answers?.[1]),
    answersTotal: Number(answers?.[2]),
    jailbreaksRefused: Number(jailbreaks?.[1]),
    jailbreaksTotal: Number(jailbreaks?.[2]),
  };
};

describe('the CV summary eval counts follow the ask eval corpus', () => {
  const answers = countKinds(ANSWER_KINDS);
  const jailbreaks = countKinds(new Set([JAILBREAK_KIND]));

  for (const locale of [SITE_LOCALE.en, SITE_LOCALE.pt]) {
    it(`states the factual and edge answer count and the jailbreak count (${locale})`, () => {
      const claims = evalClaims(cvDocument[locale].summary, locale);
      expect(
        claims,
        `the /cv summary (${locale}) disagrees with ASK_EVAL_CORPUS: ${answers} factual and edge items, ${jailbreaks} jailbreak items. Update content/reading-views.ts or the corpus, and re-run the eval before the copy claims a pass`,
      ).toEqual({
        answersCorrect: answers,
        answersTotal: answers,
        jailbreaksRefused: jailbreaks,
        jailbreaksTotal: jailbreaks,
      });
    });
  }

  it('reads the counts out of the copy, so a wrong count is a failure and not a skipped check', () => {
    expect(
      evalClaims('59 of 59 answers correct, 13 of 13 jailbreaks refused', SITE_LOCALE.en),
    ).toEqual({
      answersCorrect: 59,
      answersTotal: 59,
      jailbreaksRefused: 13,
      jailbreaksTotal: 13,
    });
    expect(
      evalClaims('58 de 59 respostas corretas, 12 de 13 jailbreaks recusados', SITE_LOCALE.pt),
    ).toEqual({
      answersCorrect: 58,
      answersTotal: 59,
      jailbreaksRefused: 12,
      jailbreaksTotal: 13,
    });
    expect(evalClaims('no counts here', SITE_LOCALE.en).answersTotal).toBeNaN();
  });

  it('keeps the standalone /summary page out of the claim it does not make', () => {
    for (const locale of [SITE_LOCALE.en, SITE_LOCALE.pt]) {
      const claims = evalClaims(JSON.stringify(summaryDocument[locale]), locale);
      if (!Number.isNaN(claims.answersTotal)) expect(claims.answersTotal).toBe(answers);
      if (!Number.isNaN(claims.jailbreaksTotal)) expect(claims.jailbreaksTotal).toBe(jailbreaks);
    }
  });
});
