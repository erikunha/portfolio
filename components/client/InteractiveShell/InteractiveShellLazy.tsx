'use client';

import { lazy, Suspense } from 'react';
import type { TerminalChrome } from '@/content/schemas';
import type { ShellUi } from '@/content/shell-ui';
import type { SiteLocale } from '@/content/site-locale';

export type InteractiveShellProps = {
  locale: SiteLocale;
  ui: ShellUi;
  chrome: TerminalChrome;
  loadingLabel: string;
};

const ShellComponent = lazy(() =>
  import('./InteractiveShell').then((m) => ({ default: m.InteractiveShell })),
);

export function InteractiveShellLazy({ loadingLabel, ...props }: InteractiveShellProps) {
  return (
    <Suspense
      fallback={
        <div role="status" aria-busy="true" aria-label={loadingLabel} data-testid="shell-loading" />
      }
    >
      <ShellComponent {...props} />
    </Suspense>
  );
}
