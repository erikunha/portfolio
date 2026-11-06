'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';
import { localeOfPath, type SiteLocale } from '@/content/site-locale';
import { ErrorBoundary } from '../../ErrorBoundary';

export function LazyIsland({
  loading,
  failed,
  locale,
  minHeight,
  children,
}: {
  loading: ReactNode;
  failed?: ReactNode;
  locale?: SiteLocale;
  minHeight?: string;
  children: ReactNode;
}) {
  const pathLocale = localeOfPath(usePathname());
  return (
    <ErrorBoundary
      fallback={failed}
      locale={locale ?? pathLocale}
      {...(minHeight ? { minHeight } : {})}
    >
      <Suspense fallback={loading}>{children}</Suspense>
    </ErrorBoundary>
  );
}
