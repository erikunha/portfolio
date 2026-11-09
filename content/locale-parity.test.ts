import { describe, expect, it } from 'vitest';
import { aboutContent } from './about';
import { dawMixerCopy } from './daw-mixer';
import { gitLog } from './git-log';
import { perfReceipts } from './perf-receipts';
import { profilePresentation } from './profile';
import { projects } from './projects';
import { cvDocument, summaryDocument } from './reading-views';
import { SITE_LOCALE } from './site-locale';
import { WORK_SCOPE } from './work-scope';

const PT = SITE_LOCALE.pt;
const ENGLISH_ONLY_TOKENS = /\b(YR|GROUP|COMPANY|OUTREACH|RECORDS|WEEKLY|formerly|first)\b/;
const DECIMAL_POINT = /\d\.\d/;
const DECIMAL_POINT_MAGNITUDE = /\d\.\d+\s?[MB]\b/;

describe('pt copy states the same facts in Portuguese', () => {
  it('shows the pt summary header with the pt location line, not the en one', () => {
    expect(
      summaryDocument[PT].context,
      'the /pt/summary meta line must use the pt location (Brasil, disponível agora), not the English one',
    ).toContain(profilePresentation[PT].location);
  });

  it('shows the pt CV header country in Portuguese', () => {
    expect(cvDocument[PT].location, 'the /pt/cv header says Brasil, not Brazil').toBe(
      'Paulínia, Brasil',
    );
  });

  it('keeps every pt project stat free of English-only words and decimal points', () => {
    const stats = projects[PT].flatMap((project) =>
      project.stats.map((stat) => `${stat.label} ${stat.value}`),
    );
    for (const stat of stats) {
      expect(stat, `pt project stat "${stat}" must not carry an English-only word`).not.toMatch(
        ENGLISH_ONLY_TOKENS,
      );
      expect(stat, `pt project stat "${stat}" must use the decimal comma`).not.toMatch(
        DECIMAL_POINT,
      );
    }
  });

  it('writes pt career numbers with the decimal comma', () => {
    const text = JSON.stringify(gitLog[PT]);
    expect(text, 'pt career entries must not mix 31,1M with 2.1M+').not.toMatch(
      DECIMAL_POINT_MAGNITUDE,
    );
  });

  it('translates the Encora former-name note in the pt career log', () => {
    expect(JSON.stringify(gitLog[PT])).not.toMatch(/formerly/);
  });

  it('keeps the hospital platform detail in the pt CV, as the en CV does', () => {
    const entry = cvDocument[PT].experience.find((item) => item.company.startsWith('Independent'));
    expect(entry?.bullets.join(' '), 'the pt CV drops the service-orders detail').toContain(
      'ordens de serviço',
    );
  });

  it('does not leave English words in the pt work scope or status line', () => {
    expect(WORK_SCOPE[PT]).not.toMatch(ENGLISH_ONLY_TOKENS);
    const { statusPrefix, role, statusSuffix } = aboutContent[PT].whoami;
    const sentence = `${statusPrefix}${role}${statusSuffix}`;
    expect(sentence, 'the role word is an adjective; pt needs a noun before it').toContain(
      `nível ${role}`,
    );
  });
});

describe.each(Object.values(SITE_LOCALE))('stack groups (%s)', (locale) => {
  it('never repeats a group label as one of its own chips', () => {
    for (const group of aboutContent[locale].stack.groups) {
      expect(group.items, `group ${group.label} lists itself as a chip`).not.toContain(group.label);
    }
  });
});

describe('pt perf receipts', () => {
  it('writes displayed numbers with pt separators and keeps notes in Portuguese', () => {
    const lcp = perfReceipts[PT].find((receipt) => receipt.metric === 'LCP');
    expect(lcp?.displayValue, 'pt LCP receipt must use the dot thousands separator').toBe(
      '2.544 → 1.308ms',
    );
    const cls = perfReceipts[PT].find((receipt) => receipt.metric === 'CLS');
    expect(cls?.displayValue, 'pt CLS receipt must use the decimal comma').toBe('0,166 → 0');
    const sameNote = perfReceipts[PT].filter(
      (receipt, index) => receipt.note === perfReceipts[SITE_LOCALE.en][index]?.note,
    );
    expect(
      sameNote.map((receipt) => receipt.metric),
      'a pt receipt note identical to the en one was never translated',
    ).toEqual([]);
  });
});

describe('DAW mixer control names', () => {
  const SAME_IN_BOTH_LANGUAGES = new Set(['fader', 'solo']);

  it('translates each control name for pt unless the term is identical in both languages', () => {
    const en = dawMixerCopy[SITE_LOCALE.en].controls;
    const pt = dawMixerCopy[PT].controls;
    const pairs: Array<[string, string]> = [
      [en.vuMeter, pt.vuMeter],
      [en.fader, pt.fader],
      [en.degrees, pt.degrees],
      [en.buttons.R, pt.buttons.R],
      [en.buttons.M, pt.buttons.M],
      [en.buttons.S, pt.buttons.S],
    ];
    for (const [english, portuguese] of pairs) {
      if (SAME_IN_BOTH_LANGUAGES.has(english)) continue;
      expect(portuguese, `pt control name "${portuguese}" is the en text "${english}"`).not.toBe(
        english,
      );
    }
  });
});
