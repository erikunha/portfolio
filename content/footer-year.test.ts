import { afterEach, describe, expect, it, vi } from 'vitest';
import { SITE_LOCALE } from './site-locale';

const FUTURE_YEAR = 2031;

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

describe('footer copyright year', () => {
  it.each(Object.values(SITE_LOCALE))('follows the build year (%s)', async (locale) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(FUTURE_YEAR, 5, 1)));
    vi.resetModules();
    const { footerContent } = await import('./footer');
    expect(footerContent[locale].copyright).toContain(`© ${FUTURE_YEAR} erik cunha`);
  });
});
