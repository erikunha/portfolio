import { SECTION_LABELS } from '@/content/section-labels';
import { SHELL_MODULE_HEADER, SHELL_MODULE_MOBILE_HEADER } from '@/content/shell-section';
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
      header={SHELL_MODULE_HEADER}
      mobileHeader={SHELL_MODULE_MOBILE_HEADER}
      name={SECTION_LABELS[locale]['sec-shell']}
      icon={<IconShell />}
    >
      <ErrorBoundary locale={locale}>
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
