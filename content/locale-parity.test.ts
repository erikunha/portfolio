import { describe, expect, it } from 'vitest';
import { aboutContent } from './about';
import { gitLog } from './git-log';
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
    const entry = cvDocument[PT].experience.find((item) => item.company.startsWith('Canon'));
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
