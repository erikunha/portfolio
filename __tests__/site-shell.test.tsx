import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

import { AppShell } from '@/components/AppShell';
import { SiteShell } from '@/components/SiteShell';
import { NAVIGATION, siteNavChrome } from '@/content/navigation';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';

const LOCALES: readonly SiteLocale[] = Object.values(SITE_LOCALE);

async function topElement(load: () => Promise<ReactElement>): Promise<ReactElement> {
  return load();
}

describe('SiteShell', () => {
  for (const locale of LOCALES) {
    it(`builds the ${locale} chrome from the one navigation source`, () => {
      const shell = SiteShell({ locale, children: null });
      expect(shell.type).toBe(AppShell);
      const props = shell.props as React.ComponentProps<typeof AppShell>;

      expect(props.locale).toBe(locale);
      expect(props.chrome).toEqual(siteNavChrome(locale));
      expect(props.skipLabel).toBe(NAVIGATION[locale].copy.skipLabel);
    });
  }
});

describe('every page frame renders through SiteShell', () => {
  for (const locale of LOCALES) {
    it(`SiteHome, ReadingShell, LinksPage and NotFoundPage open with SiteShell in ${locale}`, async () => {
      const { SiteHome } = await import('@/components/SiteHome');
      const { ReadingShell } = await import('@/components/reading/ReadingShell');
      const { LinksPage } = await import('@/components/links/LinksPage');
      const { NotFoundPage } = await import('@/components/ErrorPages/NotFoundPage');
      const frames = await Promise.all([
        topElement(async () => SiteHome({ locale })),
        topElement(async () => ReadingShell({ locale, route: '/cv', children: null })),
        topElement(async () => LinksPage({ locale })),
        topElement(async () => NotFoundPage({ locale })),
      ]);

      for (const frame of frames) {
        expect(frame.type).toBe(SiteShell);
        expect((frame.props as { locale: SiteLocale }).locale).toBe(locale);
      }
    });
  }
});

describe('every static page hands its own route to the shell', () => {
  for (const locale of LOCALES) {
    it(`SiteHome, CvPage, SummaryPage and NotFoundPage name their route in ${locale}`, async () => {
      const { SiteHome } = await import('@/components/SiteHome');
      const { CvPage } = await import('@/components/reading/CvPage');
      const { SummaryPage } = await import('@/components/reading/SummaryPage');
      const { NotFoundPage } = await import('@/components/ErrorPages/NotFoundPage');
      const { readingViews } = await import('@/content/reading-views');
      const { localizedPath } = await import('@/content/site-locale');
      const routeOf = (frame: ReactElement) => (frame.props as { route?: string }).route;

      expect(routeOf(SiteHome({ locale }))).toBe(localizedPath(locale, '/'));
      expect(routeOf(NotFoundPage({ locale })), 'a 404 has no route of its own').toBeUndefined();

      const cv = CvPage({ locale });
      const summary = SummaryPage({ locale });
      expect((cv.props as { route?: string }).route).toBe(readingViews[locale].cv.path);
      expect((summary.props as { route?: string }).route).toBe(readingViews[locale].summary.path);
    });
  }

  it('LinksPage names the links route of its language', async () => {
    const { LinksPage } = await import('@/components/links/LinksPage');
    const { LINKS_LOCALE, LINKS_PATH } = await import('@/content/links.constants');
    for (const locale of Object.values(LINKS_LOCALE)) {
      expect((LinksPage({ locale }).props as { route?: string }).route).toBe(LINKS_PATH[locale]);
    }
  });
});
