import { InteractiveShellLazy } from '../client/InteractiveShellLazy';
import { ErrorBoundary } from '../ErrorBoundary';
import { IconShell } from '../Icons';
import { Module } from '../responsive/Module';

export function ShellSection() {
  return (
    <Module
      id="sec-shell"
      header="./EXEC INTERACTIVE_SHELL"
      mobileHeader="/BIN/SH · INTERACTIVE"
      icon={<IconShell />}
    >
      <ErrorBoundary>
        <InteractiveShellLazy />
      </ErrorBoundary>
    </Module>
  );
}
