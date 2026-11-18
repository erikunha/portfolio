'use client';

import { usePathname } from 'next/navigation';
import { SiteShell } from '@/components/SiteShell';
import { errorsClientContent as errorsContent } from '@/content/errors-client';
import { localeOfPath } from '@/content/site-locale';
import { type RouteErrorProps, ServerErrorMain, useErrorReport } from './ErrorPages.client';

export function RouteErrorPage({ error, retry }: RouteErrorProps) {
  const locale = localeOfPath(usePathname());
  const content = errorsContent[locale];
  const stamps = useErrorReport('[RouteError]', error);

  return (
    <SiteShell locale={locale}>
      <ServerErrorMain
        retry={retry}
        content={content.serverError}
        stamps={stamps}
        digest={error.digest}
      />
    </SiteShell>
  );
}
