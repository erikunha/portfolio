import { SECTION_LABELS } from '@/content/section-labels';
import { shellLoadingLabel, shellUi } from '@/content/shell-ui';
import type { SiteLocale } from '@/content/site-locale';
import { shellChrome } from '@/content/terminal-chrome';
import { InteractiveShellLazy } from '../../client/InteractiveShell/InteractiveShellLazy';
import { ErrorBoundary } from '../../ErrorBoundary';
import { IconShell } from '../../Icons';
import { Module } from '../../responsive/Module';

export function ShellSection({ locale }: { locale: SiteLocale }) {
  return (
    <Module
      id="sec-shell"
      header="./EXEC INTERACTIVE_SHELL"
      mobileHeader="/BIN/SH · INTERACTIVE"
      name={SECTION_LABELS[locale]['sec-shell']}
      icon={<IconShell />}
    >
      <ErrorBoundary>
        <InteractiveShellLazy
          locale={locale}
          ui={shellUi[locale]}
          chrome={shellChrome[locale]}
          loadingLabel={shellLoadingLabel[locale]}
        />
      </ErrorBoundary>
    </Module>
  );
}
