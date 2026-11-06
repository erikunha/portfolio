'use client';

import { type ReactNode, Suspense } from 'react';
import type { SiteLocale } from '@/content/site-locale';
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
  return (
    <ErrorBoundary
      fallback={failed}
      {...(locale ? { locale } : {})}
      {...(minHeight ? { minHeight } : {})}
    >
      <Suspense fallback={loading}>{children}</Suspense>
    </ErrorBoundary>
  );
}
