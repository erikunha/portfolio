'use client';

import { usePathname } from 'next/navigation';
import { errorsClientContent as errorsContent } from '@/content/errors-client';
import { localeOfPath, SITE_HTML_LANG } from '@/content/site-locale';
import { type RouteErrorProps, ServerErrorMain, useErrorReport } from './ErrorPages.client';

const FALLBACK_MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export function GlobalErrorPage({ error, reset }: RouteErrorProps) {
  const locale = localeOfPath(usePathname());
  const content = errorsContent[locale].serverError;
  const stamps = useErrorReport('[GlobalError]', error);

  return (
    <html lang={SITE_HTML_LANG[locale]}>
      <body style={{ fontFamily: FALLBACK_MONO_FONT }}>
        <ServerErrorMain reset={reset} content={content} stamps={stamps} digest={error.digest} />
      </body>
    </html>
  );
}
