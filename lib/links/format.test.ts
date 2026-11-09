import { describe, expect, it } from 'vitest';
import { LINKS_LOCALE } from '@/content/links.constants';
import { formatCompact } from './format';

describe('formatCompact', () => {
  it('abbreviates thousands in English', () => {
    expect(formatCompact(12_400, LINKS_LOCALE.en)).toBe('12.4K');
  });

  it('abbreviates thousands in Portuguese with the pt-BR decimal comma', () => {
    expect(formatCompact(12_400, LINKS_LOCALE.pt)).toMatch(/^12,4\s?mil$/);
  });

  it('leaves small counts whole', () => {
    expect(formatCompact(48, LINKS_LOCALE.en)).toBe('48');
  });

  it('keeps one decimal at most', () => {
    expect(formatCompact(1_234_567, LINKS_LOCALE.en)).toBe('1.2M');
  });
});
