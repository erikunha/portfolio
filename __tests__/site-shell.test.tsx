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
        topElement(async () => ReadingShell({ locale, children: null })),
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
