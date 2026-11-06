'use client';

import { lazy, Suspense } from 'react';
import type { RouteErrorProps } from '@/components/ErrorPages/ErrorPages.client';

const RouteErrorPage = lazy(() =>
  import('@/components/ErrorPages/RouteErrorPage.client').then((mod) => ({
    default: mod.RouteErrorPage,
  })),
);

export function RouteError(props: RouteErrorProps) {
  return (
    <Suspense fallback={null}>
      <RouteErrorPage {...props} />
    </Suspense>
  );
}
