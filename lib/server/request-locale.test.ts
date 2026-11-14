import { describe, expect, it } from 'vitest';
import { SITE_LOCALE_HEADER } from '@/lib/stream-protocol';
import { localeFromRequest } from './request-locale';

const requestWith = (value?: string) =>
  new Request('https://example.test/api', {
    headers: value === undefined ? {} : { [SITE_LOCALE_HEADER]: value },
  });

describe('localeFromRequest', () => {
  it.each([
    ['en', 'en'],
    ['pt', 'pt'],
  ])('reads the %s locale header', (header, expected) => {
    expect(localeFromRequest(requestWith(header))).toBe(expected);
  });

  it.each([
    ['a missing header', undefined],
    ['an unknown locale', 'fr'],
    ['a regional tag', 'pt-BR'],
    ['a different case', 'PT'],
    ['an empty value', ''],
  ])('falls back to English for %s', (_label, header) => {
    expect(localeFromRequest(requestWith(header))).toBe('en');
  });
});
