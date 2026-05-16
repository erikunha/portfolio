
import { InteractiveShell } from '../client/InteractiveShell';
import { ErrorBoundary } from '../ErrorBoundary.client';
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
        <InteractiveShell />
      </ErrorBoundary>
    </Module>
  );
}
