'use client';

import { type ReactNode, Suspense } from 'react';
import type { SiteLocale } from '@/content/site-locale';
import { ErrorBoundary } from '../../ErrorBoundary';

export function LazyIsland({
  loading,
  failed,
  locale,
  children,
}: {
  loading: ReactNode;
  failed?: ReactNode;
  locale?: SiteLocale;
  children: ReactNode;
}) {
  return (
    <ErrorBoundary fallback={failed} {...(locale ? { locale } : {})}>
      <Suspense fallback={loading}>{children}</Suspense>
    </ErrorBoundary>
  );
}
