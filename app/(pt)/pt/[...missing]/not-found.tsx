import type { Metadata } from 'next';
import { NotFoundPage } from '@/components/ErrorPages/NotFoundPage';
import { errorsContent } from '@/content/errors';
import { SITE_LOCALE } from '@/content/site-locale';

const locale = SITE_LOCALE.pt;

export const metadata: Metadata = { title: errorsContent[locale].notFound.metaTitle };

export default function PtNotFound() {
  return <NotFoundPage locale={locale} />;
}
