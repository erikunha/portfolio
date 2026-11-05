import type { Metadata } from 'next';
import { localizedPageMetadata } from '@/app/_lib/locale-metadata';
import { SiteHome } from '@/components/SiteHome';
import { profilePresentation } from '@/content/profile';
import { SITE_HTML_LANG, SITE_LOCALE } from '@/content/site-locale';

const locale = SITE_LOCALE.pt;

// pt-BR home: canonical is the pt address itself, alternates point at the
// English bare address plus x-default, OG locale is pt_BR (DECISIONS
// 2026-08-30: each language names itself canonical, never one for both).
export const metadata: Metadata = localizedPageMetadata({
  locale,
  path: '/',
  title: profilePresentation[locale].pageTitle,
  description: profilePresentation[locale].metaDescription,
});

// The root <html lang> stays en-US (the default locale); the pt subtree
// declares its language here so screen readers switch voice, the same shape
// the /links page ships since the App Router landed.
export default function PtHome() {
  return (
    <div lang={SITE_HTML_LANG[locale]}>
      <SiteHome locale={locale} />
    </div>
  );
}
