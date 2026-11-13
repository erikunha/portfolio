import { describe, expect, it } from 'vitest';
import { heroContent } from '@/content/hero';
import { SITE_LOCALE } from '@/content/site-locale';

const PT_CURRENCY = 'US$ ';
const EN_CURRENCY = '$';
const BARE_DOLLAR = /(^|[^S])\$/;

const strip = (value: string, currency: string) =>
  value.startsWith(currency) ? value.slice(currency.length) : value;

describe('hero impact statistics in each locale', () => {
  const en = heroContent[SITE_LOCALE.en].stats;
  const pt = heroContent[SITE_LOCALE.pt].stats;

  it('writes the same figures in both locales', () => {
    expect(pt).toHaveLength(en.length);
    for (const [index, stat] of en.entries()) {
      const twin = pt[index];
      if (stat.value.startsWith(EN_CURRENCY)) {
        expect(twin?.value, `${stat.value} in pt-BR`).toBe(
          `${PT_CURRENCY}${strip(stat.value, EN_CURRENCY)}`,
        );
      }
    }
  });

  it('writes a dollar amount as US$ on the pt-BR page, the way the pt-BR copy does elsewhere', () => {
    for (const stat of pt) {
      expect(stat.value, `${stat.label} carries a bare dollar sign`).not.toMatch(BARE_DOLLAR);
    }
  });
});
