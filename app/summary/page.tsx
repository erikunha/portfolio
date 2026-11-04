import type { Metadata } from 'next';
import { SummaryPage } from '@/components/reading/SummaryPage';
import { readingViews } from '@/content/reading-views';
import { SITE_LOCALE } from '@/content/site-locale';
import { localizedPageMetadata } from '../../_lib/locale-metadata';

const locale = SITE_LOCALE.en;
const { summary } = readingViews[locale];

export const metadata: Metadata = localizedPageMetadata({
  locale,
  path: '/summary',
  title: summary.title,
  description: summary.description,
});

export default function SummaryRoute() {
  return <SummaryPage locale={locale} />;
}
