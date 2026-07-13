#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const NO_LEAKS = 0;
const LEAKS_FOUND = 1;
const GITLEAKS_BIN = process.env.GITLEAKS_BIN ?? 'gitleaks';

const res = spawnSync(
  GITLEAKS_BIN,
  ['git', '--staged', '--no-banner', '--redact', '--config', '.gitleaks.toml'],
  { stdio: 'inherit' },
);

if (res.error !== undefined || res.status === null) {
  console.error(
    `\n[gitleaks] could not run gitleaks (${res.error?.message ?? 'killed by a signal'}).\n` +
      '\nThis hook fails closed on purpose. A secret-scanner that silently skips when it is\n' +
      'missing is the same as no scanner, and you would never find out. Install it:\n' +
      '\n  brew install gitleaks\n' +
      '\nCI runs the same scan on a pinned binary, so a bypass here is caught there --\n' +
      'but only AFTER the secret is already in git history, which is the thing this\n' +
      'hook exists to prevent.\n',
  );
  process.exit(1);
}

if (res.status === LEAKS_FOUND) {
  console.error(
    '\n[gitleaks] a secret was found in the STAGED changes; the commit is blocked.\n' +
      '\nThe finding is above (values redacted). Once a secret reaches a commit it is in\n' +
      'git history, and pushing publishes it -- rotating the credential is then the only\n' +
      'real remedy. Unstage it, move the value to an env var, and commit again.\n' +
      '\nIf it is a false positive, add a `regexes` entry to .gitleaks.toml matching the\n' +
      'exact VALUE. Never a `paths` entry: a paths entry exempts that whole file from\n' +
      'every rule, so a real credential committed there later would never be seen. And\n' +
      'never a "gitleaks:allow" comment or a .gitleaksignore -- both are unreviewable,\n' +
      'and scripts/check-gitleaks-fixture.mjs fails the build if either appears.\n',
  );
  process.exit(1);
}

if (res.status !== NO_LEAKS) {
  console.error(
    `\n[gitleaks] exited ${res.status}, which is neither ${NO_LEAKS} (clean) nor ${LEAKS_FOUND} (leaks found). Treating an unknown exit code as clean would be a fail-open.\n`,
  );
  process.exit(1);
}
