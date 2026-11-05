import type { Metadata } from 'next';
import { localizedPageMetadata } from '@/app/_lib/locale-metadata';
import { NoscriptBar } from '@/components/NoscriptBar';
import { SummaryPage } from '@/components/reading/SummaryPage';
import { readingViews } from '@/content/reading-views';
import { SITE_HTML_LANG, SITE_LOCALE } from '@/content/site-locale';

const locale = SITE_LOCALE.pt;
const { summary } = readingViews[locale];

export const metadata: Metadata = localizedPageMetadata({
  locale,
  path: '/summary',
  title: summary.title,
  description: summary.description,
});

export default function PtSummaryRoute() {
  return (
    <div lang={SITE_HTML_LANG[locale]}>
      <NoscriptBar locale={locale} />
      <SummaryPage locale={locale} />
    </div>
  );
}
