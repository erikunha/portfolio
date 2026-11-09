'use client';

import { usePathname } from 'next/navigation';
import { lazy, Suspense } from 'react';
import { PageMain } from '@/components/PageMain';
import { type ServerErrorCore, serverErrorCore } from '@/content/server-error-core';
import { localeOfPath, SITE_HTML_LANG } from '@/content/site-locale';
import type { RouteErrorProps } from './ErrorPages.client';
import { ERROR_MAIN_CLASS } from './error-main';

const FALLBACK_MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function StaticServerError({
  content,
  reset,
}: Pick<RouteErrorProps, 'reset'> & { content: ServerErrorCore }) {
  return (
    <PageMain className={ERROR_MAIN_CLASS}>
      <h1 className="err-h1">{content.code}</h1>
      <div className="err-log" role="alert">
        <p className="err-text">{content.message}</p>
      </div>
      <div className="err-actions">
        <button type="button" className="err-action err-action-primary" onClick={reset}>
          {content.retryLabel}
        </button>
        <a className="err-action" href={content.home.href}>
          {content.home.label}
        </a>
      </div>
    </PageMain>
  );
}

function StaticServerErrorBody({ reset }: RouteErrorProps) {
  const locale = localeOfPath(usePathname());
  return <StaticServerError content={serverErrorCore[locale]} reset={reset} />;
}

const GlobalErrorBody = lazy(() =>
  import('./GlobalErrorBody.client')
    .then((mod) => ({ default: mod.GlobalErrorBody }))
    .catch(() => ({ default: StaticServerErrorBody })),
);

export function GlobalErrorPage({ error, reset }: RouteErrorProps) {
  const locale = localeOfPath(usePathname());

  return (
    <html lang={SITE_HTML_LANG[locale]}>
      <body style={{ fontFamily: FALLBACK_MONO_FONT }}>
        <Suspense fallback={<StaticServerError content={serverErrorCore[locale]} reset={reset} />}>
          <GlobalErrorBody error={error} reset={reset} />
        </Suspense>
      </body>
    </html>
  );
}
