import { describe, expect, it } from 'vitest';
import { linksPageMetadata } from '@/app/links/_lib/metadata';
import { LINKS_LOCALE } from '@/content/links.constants';
import { readingViews } from '@/content/reading-views';
import {
  DEFAULT_SITE_LOCALE,
  languageSwitchPaths,
  localeAlternates,
  localizedPath,
  SITE_LOCALE,
} from '@/content/site-locale';

// The hreflang contract the whole site ships (DECISIONS 2026-08-30): each
// language names itself canonical; alternates join the pair plus x-default.
describe('locale alternates', () => {
  it('keeps English at the bare address and pt under /pt', () => {
    expect(DEFAULT_SITE_LOCALE).toBe(SITE_LOCALE.en);
    expect(localizedPath(SITE_LOCALE.en, '/')).toBe('/');
    expect(localizedPath(SITE_LOCALE.pt, '/')).toBe('/pt');
    expect(localizedPath(SITE_LOCALE.pt, '/cv')).toBe('/pt/cv');
  });

  it('joins each page pair with pt-BR, en-US and x-default', () => {
    expect(localeAlternates('/')).toEqual({
      en: '/',
      pt: '/pt',
      languages: { 'pt-BR': '/pt', 'en-US': '/', 'x-default': '/' },
    });
    expect(localeAlternates('/cv')).toEqual({
      en: '/cv',
      pt: '/pt/cv',
      languages: { 'pt-BR': '/pt/cv', 'en-US': '/cv', 'x-default': '/cv' },
    });
  });

  it('carries hash fragments onto the pt prefix without a slash', () => {
    expect(localizedPath(SITE_LOCALE.pt, '/#sec-readme')).toBe('/pt#sec-readme');
    expect(localizedPath(SITE_LOCALE.pt, '/')).toBe('/pt');
    expect(localizedPath(SITE_LOCALE.en, '/#sec-readme')).toBe('/#sec-readme');
  });

  it('the /links pair predates the site scheme and stays as decided', () => {
    const pt = linksPageMetadata(LINKS_LOCALE.pt);
    const en = linksPageMetadata(LINKS_LOCALE.en);
    expect(pt.alternates?.canonical).toBe('/links');
    expect(en.alternates?.canonical).toBe('/links/en');
    expect(pt.alternates?.languages).toEqual({
      'pt-BR': '/links',
      'en-US': '/links/en',
      'x-default': '/links',
    });
  });

  it('reading views carry localized paths in both locales', () => {
    expect(readingViews[SITE_LOCALE.en].cv.path).toBe('/cv');
    expect(readingViews[SITE_LOCALE.pt].cv.path).toBe('/pt/cv');
    expect(readingViews[SITE_LOCALE.pt].summary.path).toBe('/pt/summary');
  });

  it('the language switch resolves only where both locales exist', () => {
    expect(languageSwitchPaths('/')).toEqual({ en: '/', pt: '/pt' });
    expect(languageSwitchPaths('/pt/cv')).toEqual({ en: '/cv', pt: '/pt/cv' });
    expect(languageSwitchPaths('/links')).toEqual({ en: '/links/en', pt: '/links' });
    expect(languageSwitchPaths('/design-system')).toBeNull();
    expect(languageSwitchPaths('/unknown')).toBeNull();
  });
});
