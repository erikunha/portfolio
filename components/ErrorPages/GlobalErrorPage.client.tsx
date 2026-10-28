'use client';

import { useEffect } from 'react';

import { reportClientError } from '@/components/ErrorBoundary/ErrorBoundary.client';
import { errorsClientContent as errorsContent } from '@/content/errors-client';
import type { RouteErrorProps } from './ErrorPages.client';

const FALLBACK_MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export function GlobalErrorPage({ error, reset }: RouteErrorProps) {
  const content = errorsContent.serverError;
  useEffect(() => {
    reportClientError('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: FALLBACK_MONO_FONT }}>
        <main className="err-main" id="main-content">
          <h1 className="err-h1">{content.code}</h1>
          <p className="err-text">{content.message}</p>
          <div className="err-actions">
            <button type="button" className="err-action" onClick={reset}>
              {content.retryLabel}
            </button>
            <a className="err-action" href={content.home.href}>
              {content.home.label}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
