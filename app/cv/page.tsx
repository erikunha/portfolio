import type { Metadata } from 'next';
import { CvPage } from '@/components/reading/CvPage';
import { readingViews } from '@/content/reading-views';
import { SITE_LOCALE } from '@/content/site-locale';
import { localizedPageMetadata } from '../../_lib/locale-metadata';

const locale = SITE_LOCALE.en;
const { cv } = readingViews[locale];

export const metadata: Metadata = localizedPageMetadata({
  locale,
  path: '/cv',
  title: cv.title,
  description: cv.description,
  ogType: 'profile',
});

export default function CvRoute() {
  return <CvPage locale={locale} />;
}
