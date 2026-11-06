import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { SiteLocale } from '@/content/site-locale';
import { NotFoundPage } from './NotFoundPage';

function ThrowNotFound(): never {
  notFound();
}

export function MissingRoute({ locale }: { locale: SiteLocale }) {
  return (
    <Suspense fallback={<NotFoundPage locale={locale} />}>
      <ThrowNotFound />
    </Suspense>
  );
}
