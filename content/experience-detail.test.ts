import { describe, expect, it } from 'vitest';
import { experienceDetail } from './experience-detail';
import { gitLog } from './git-log';
import { SITE_LOCALE } from './site-locale';

const RESUME_NUMBERS = {
  [SITE_LOCALE.en]: [
    '14 to the correct 75',
    '55 to 1',
    '0.166 to zero',
    '2,544 to 1,308 ms',
    '79 to 96',
    '94.7% line and 85.4% branch',
    '85.4% and 65.8%',
    '29-permission',
    'about 5 minutes to about 45 seconds',
    'about 52%',
    'about 33%',
    'about 98%',
    'about 25%',
    '1,994',
    '4+ partner insurers',
    '106 cameras and 36 traffic sensors',
    '319.8 km',
    '850,000 vehicles',
    'about 40s to under 1s',
    '2s to 200ms',
    'about 80%',
    'about 40%',
    '800+ stores',
    '8M+ monthly users',
    'R$2.5B',
    'R$7.9B',
    '20+ Google Optimize 360',
    '12-agent',
    '€1.197B',
    '31.1M',
    '300,000+ sources',
    '$8M Series A',
  ],
  [SITE_LOCALE.pt]: [
    'de 14 para os 75 corretos',
    'de 55 para 1',
    'de 0,166 para zero',
    'de 2.544 para 1.308 ms',
    'de 79 para 96',
    '94,7% de cobertura de linhas e 85,4% de ramos',
    '85,4% e 65,8%',
    '29 permissões',
    'cerca de 5 minutos para cerca de 45 segundos',
    'cerca de 52%',
    'cerca de 33%',
    'cerca de 98%',
    'cerca de 25%',
    '1.994',
    'mais de 4 seguradoras',
    '106 câmeras e 36 sensores',
    '319,8 km',
    '850.000 veículos',
    'cerca de 40s para menos de 1s',
    'de 2s para 200ms',
    'cerca de 80%',
    'cerca de 40%',
    'mais de 800 lojas',
    '8M+ usuários',
    'R$ 2,5B',
    'R$ 7,9B',
    'mais de 20 experimentos A/B no Google Optimize 360',
    '12 agentes',
    '€1,197B',
    '31,1M',
    'mais de 300.000 fontes',
    'US$ 8M',
  ],
};

describe.each(Object.values(SITE_LOCALE))('resume experience detail (%s)', (locale) => {
  const text = Object.values(experienceDetail[locale])
    .flatMap((detail) => [detail.context, ...detail.highlights])
    .join(' ');

  it('keeps every resume number exactly as the resume states it', () => {
    const missing = RESUME_NUMBERS[locale].filter((token) => !text.includes(token));
    expect(
      missing,
      'A resume figure is missing or reworded in the experience detail. The resume is the source of truth for every number on /cv, in both locales, with pt-BR number formatting.',
    ).toEqual([]);
  });

  it('writes no semicolon, which the CV bullets treat as a fragment break', () => {
    expect(text).not.toContain(';');
  });

  it('is attached to a career entry for every key', () => {
    const branches = new Set(gitLog[locale].map((entry) => entry.branch));
    const orphans = Object.keys(experienceDetail[locale]).filter((key) => !branches.has(key));
    expect(orphans, 'a detail keyed to no career entry is never rendered').toEqual([]);
  });
});

describe('resume experience detail parity', () => {
  it('has the same jobs and bullet count in English and Portuguese', () => {
    const shape = (locale: (typeof SITE_LOCALE)[keyof typeof SITE_LOCALE]) =>
      Object.entries(experienceDetail[locale]).map(([key, detail]) => [
        key,
        detail.highlights.length,
      ]);
    expect(shape(SITE_LOCALE.pt)).toEqual(shape(SITE_LOCALE.en));
  });
});
