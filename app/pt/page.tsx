import type { Metadata } from 'next';
import { localizedPageMetadata } from '@/app/_lib/locale-metadata';
import { NoscriptBar } from '@/components/NoscriptBar';
import { SiteHome } from '@/components/SiteHome';
import { profilePresentation } from '@/content/profile';
import { SITE_HTML_LANG, SITE_LOCALE } from '@/content/site-locale';

const locale = SITE_LOCALE.pt;

export const metadata: Metadata = localizedPageMetadata({
  locale,
  path: '/',
  title: profilePresentation[locale].pageTitle,
  description: profilePresentation[locale].metaDescription,
});

export default function PtHome() {
  return (
    <div lang={SITE_HTML_LANG[locale]}>
      <NoscriptBar locale={locale} />
      <SiteHome locale={locale} />
    </div>
  );
}
