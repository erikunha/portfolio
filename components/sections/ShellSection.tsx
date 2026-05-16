
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
      postBody={
        <p className="shell__commands">
          {'commands: help · whoami · whoami --recursive · ls · cat skills.md · cat ~/.now · contact · face · hire · clear · ask <question>'}
        </p>
      }
    >
      <ErrorBoundary>
        <InteractiveShell />
      </ErrorBoundary>
    </Module>
  );
}
