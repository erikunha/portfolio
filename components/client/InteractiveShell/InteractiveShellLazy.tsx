'use client';

import { lazy } from 'react';
import type { TerminalChrome } from '@/content/schemas';
import type { ShellUi } from '@/content/shell-ui';
import type { SiteLocale } from '@/content/site-locale';
import { LazyIsland } from '../LazyIsland';

export type InteractiveShellProps = {
  locale: SiteLocale;
  ui: ShellUi;
  chrome: TerminalChrome;
  loadingLabel: string;
};

export const SHELL_MIN_HEIGHT = 'calc(5 * var(--spacing-target))';

const ShellComponent = lazy(() =>
  import('./InteractiveShell').then((m) => ({ default: m.InteractiveShell })),
);

export function InteractiveShellLazy({ loadingLabel, ...props }: InteractiveShellProps) {
  return (
    <LazyIsland
      locale={props.locale}
      minHeight={SHELL_MIN_HEIGHT}
      loading={
        <div
          className="shell-loading"
          role="status"
          aria-busy="true"
          aria-label={loadingLabel}
          data-testid="shell-loading"
        />
      }
    >
      <ShellComponent {...props} />
    </LazyIsland>
  );
}
