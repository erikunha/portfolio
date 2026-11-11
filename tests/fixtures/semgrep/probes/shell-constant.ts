import { exec } from 'node:child_process';

// The command is a literal. No untrusted value reaches the shell, and the
// rule's own message says the finding is about untrusted input flowing into
// the command. The rule fires anyway, because its source pattern matches any
// expression, a literal included. This is the one false positive the probe
// set records, and the reason the rule cannot block a merge as it stands.
export function repositoryStatus(): void {
  exec('git status', () => undefined);
}
