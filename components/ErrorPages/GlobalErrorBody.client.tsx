'use client';

import { usePathname } from 'next/navigation';
import { serverErrorContent } from '@/content/server-error-detail';
import { localeOfPath } from '@/content/site-locale';
import { type RouteErrorProps, ServerErrorMain, useErrorReport } from './ErrorPages.client';

export function GlobalErrorBody({ error, reset }: RouteErrorProps) {
  const locale = localeOfPath(usePathname());
  const stamps = useErrorReport('[GlobalError]', error);
  return (
    <ServerErrorMain
      reset={reset}
      content={serverErrorContent[locale]}
      stamps={stamps}
      digest={error.digest}
    />
  );
}
