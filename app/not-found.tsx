import type { Metadata } from 'next';
import { NotFoundPage } from '@/components/ErrorPages/NotFoundPage';
import { errorsContent } from '@/content/errors';
import { SITE_LOCALE } from '@/content/site-locale';

export const metadata: Metadata = { title: errorsContent[SITE_LOCALE.en].notFound.metaTitle };

export default function NotFound() {
  return <NotFoundPage locale={SITE_LOCALE.en} />;
}
