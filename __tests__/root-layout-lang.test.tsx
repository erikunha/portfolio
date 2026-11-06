import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SITE_HTML_LANG, SITE_LOCALE, type SiteLocale } from '@/content/site-locale';

vi.mock('next/font/local', () => ({ default: () => ({ variable: 'font-var' }) }));
vi.mock('@/components/client/GlobalMotion', () => ({ GlobalMotion: () => null }));
vi.mock('@/components/NoscriptBar', () => ({
  NoscriptBar: ({ locale }: { locale: string }) => <i data-noscript-locale={locale} />,
}));

const LAYOUTS: Record<SiteLocale, () => Promise<typeof import('@/app/(en)/layout')>> = {
  [SITE_LOCALE.en]: () => import('@/app/(en)/layout'),
  [SITE_LOCALE.pt]: () => import('@/app/(pt)/layout'),
};

describe('root layouts', () => {
  for (const locale of Object.values(SITE_LOCALE)) {
    it(`the ${locale} root layout declares <html lang="${SITE_HTML_LANG[locale]}"> and its own chrome locale`, async () => {
      const { default: RootLayout } = await LAYOUTS[locale]();
      const html = renderToStaticMarkup(<RootLayout>body</RootLayout>);
      expect(
        html.startsWith(`<html lang="${SITE_HTML_LANG[locale]}"`),
        'the root <html> of each locale group must carry that locale lang, the one place the document language is set',
      ).toBe(true);
      expect(html).toContain(`data-noscript-locale="${locale}"`);
      expect(html).toContain('<body');
      expect(html).toContain('body</body>');
    });
  }

  it('both root layouts publish the same site metadata', async () => {
    const en = await LAYOUTS[SITE_LOCALE.en]();
    const pt = await LAYOUTS[SITE_LOCALE.pt]();
    expect(pt.metadata).toBe(en.metadata);
  });
});
