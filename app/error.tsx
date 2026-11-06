'use client';

import { lazy, Suspense } from 'react';
import type { RouteErrorProps } from '@/components/ErrorPages/ErrorPages.client';

const RouteErrorPage = lazy(() =>
  import('@/components/ErrorPages/ErrorPages.client').then((mod) => ({
    default: mod.RouteErrorPage,
  })),
);

export default function RouteError(props: RouteErrorProps) {
  return (
    <Suspense fallback={null}>
      <RouteErrorPage {...props} />
    </Suspense>
  );
}
