import { describe, expect, it } from 'vitest';
import { heroClientContent } from './hero-client';
import { HeroClientContentSchema } from './schemas';
import { SITE_LOCALE } from './site-locale';

const LITERAL_KEYS = ['bootPrompt', 'bootCommand', 'bootStatus.ok'] as const;
const STATUS_KIND_KEY = /^bootSteps\[\d+\]\.status$/;

function sentences(copy: Record<string, unknown>): [string, string][] {
  return Object.entries(copy).flatMap(([key, value]): [string, string][] => {
    if (typeof value === 'string') return [[key, value]];
    if (Array.isArray(value)) {
      return value.flatMap((item, index): [string, string][] =>
        typeof item === 'string'
          ? [[`${key}[${index}]`, item]]
          : Object.entries(item as Record<string, string>).map(
              ([field, text]): [string, string] => [`${key}[${index}].${field}`, text],
            ),
      );
    }
    return Object.entries(value as Record<string, string>).map(
      ([field, text]): [string, string] => [`${key}.${field}`, text],
    );
  });
}

describe('hero client copy per locale', () => {
  it.each(Object.values(SITE_LOCALE))('parses against the schema in %s', (locale) => {
    expect(HeroClientContentSchema.safeParse(heroClientContent[locale]).success).toBe(true);
  });

  it('translates every boot sentence into pt-BR and keeps the literal commands', () => {
    const en = sentences(heroClientContent[SITE_LOCALE.en]);
    const pt = new Map(sentences(heroClientContent[SITE_LOCALE.pt]));
    expect(pt.size, 'both locales carry the same boot fields').toBe(en.length);
    for (const [key, text] of en) {
      if (STATUS_KIND_KEY.test(key)) continue;
      if ((LITERAL_KEYS as readonly string[]).includes(key)) {
        expect(pt.get(key), `${key} is a literal command, it stays as typed`).toBe(text);
      } else {
        expect(
          pt.get(key),
          `${key} reads "${text}" on /pt: the boot sequence must be Portuguese`,
        ).not.toBe(text);
      }
    }
  });

  it('keeps the same step count and status kinds in both locales', () => {
    const kinds = (locale: keyof typeof heroClientContent) =>
      heroClientContent[locale].bootSteps.map((step) => step.status);
    expect(kinds(SITE_LOCALE.pt)).toEqual(kinds(SITE_LOCALE.en));
    expect(heroClientContent[SITE_LOCALE.pt].bootDialogDesktop).toHaveLength(
      heroClientContent[SITE_LOCALE.en].bootDialogDesktop.length,
    );
    expect(heroClientContent[SITE_LOCALE.pt].bootDialogMobile).toHaveLength(
      heroClientContent[SITE_LOCALE.en].bootDialogMobile.length,
    );
  });
});
