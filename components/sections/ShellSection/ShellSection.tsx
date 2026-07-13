import { SECTION_LABELS } from '@/content/section-labels';
import { InteractiveShellLazy } from '../../client/InteractiveShell';
import { ErrorBoundary } from '../../ErrorBoundary';
import { IconShell } from '../../Icons';
import { Module } from '../../responsive/Module';

export function ShellSection() {
  return (
    <Module
      id="sec-shell"
      header="./EXEC INTERACTIVE_SHELL"
      mobileHeader="/BIN/SH · INTERACTIVE"
      srLabel={SECTION_LABELS['sec-shell']}
      icon={<IconShell />}
    >
      <ErrorBoundary>
        <InteractiveShellLazy />
      </ErrorBoundary>
    </Module>
  );
}
