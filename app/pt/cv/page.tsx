import type { Metadata } from 'next';
import { localizedPageMetadata } from '@/app/_lib/locale-metadata';
import { CvPage } from '@/components/reading/CvPage';
import { readingViews } from '@/content/reading-views';
import { SITE_HTML_LANG, SITE_LOCALE } from '@/content/site-locale';

const locale = SITE_LOCALE.pt;
const { cv } = readingViews[locale];

export const metadata: Metadata = localizedPageMetadata({
  locale,
  path: '/cv',
  title: cv.title,
  description: cv.description,
  ogType: 'profile',
});

export default function PtCvRoute() {
  return (
    <div lang={SITE_HTML_LANG[locale]}>
      <CvPage locale={locale} />
    </div>
  );
}
