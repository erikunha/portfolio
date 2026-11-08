import type { Metadata } from 'next';
import { localizedPageMetadata } from '@/app/_lib/locale-metadata';
import { CvPage } from '@/components/reading/CvPage';
import { readingViews } from '@/content/reading-views';
import { SITE_LOCALE } from '@/content/site-locale';

const locale = SITE_LOCALE.en;
const { cv } = readingViews[locale];

export const metadata: Metadata = localizedPageMetadata({
  locale,
  path: '/cv',
  title: cv.title,
  description: cv.description,
  ogType: 'profile',
});

export const ensureStatic = 'navigation';

export default function CvRoute() {
  return <CvPage locale={locale} />;
}
