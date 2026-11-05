import type { Metadata } from 'next';
import { localizedPageMetadata } from '@/app/_lib/locale-metadata';
import { SiteHome } from '@/components/SiteHome';
import { profilePresentation } from '@/content/profile';
import { SITE_LOCALE } from '@/content/site-locale';

const locale = SITE_LOCALE.en;

export const metadata: Metadata = {
  ...localizedPageMetadata({
    locale,
    path: '/',
    title: profilePresentation[locale].pageTitle,
    description: profilePresentation[locale].metaDescription,
  }),
};

export default function Home() {
  return <SiteHome locale={locale} />;
}
