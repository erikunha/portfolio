#!/usr/bin/env node

export const NO_LEAKS = 0;
export const LEAKS_FOUND = 1;

export const MISSING_BINARY = [
  '\n[gitleaks] could not run gitleaks.\n',
  '\nThis hook fails closed on purpose. A secret-scanner that silently skips when it is',
  'missing is the same as no scanner, and you would never find out. Install it:\n',
  '\n  brew install gitleaks\n',
  '\nCI runs the same scan on a pinned binary, so a bypass here is caught there -- but only',
  'AFTER the secret is already in git history, which is the thing this hook exists to',
  'prevent.\n',
].join('\n');

export const SECRET_STAGED = [
  '\n[gitleaks] a secret was found in the STAGED changes; the commit is blocked.\n',
  '\nThe finding is above (values redacted). Once a secret reaches a commit it is in git',
  'history, and pushing publishes it -- rotating the credential is then the only real',
  'remedy. Unstage it, move the value to an env var, and commit again.\n',
  '\nIf it is a false positive, add a `regexes` entry to .gitleaks.toml matching the exact',
  'VALUE. Never a `paths` entry: a paths entry exempts that whole file from every rule, so',
  'a real credential committed there later would never be seen. And never a "gitleaks:allow"',
  'comment or a .gitleaksignore -- both are unreviewable, and scripts/check-gitleaks-fixture.mjs',
  'fails the build if either appears.\n',
].join('\n');

// The exit-code decision, kept pure so it can be tested. It is the entire fail-closed defence
// of the local gate, and it runs on every commit -- the sibling self-test script has its
// equivalent tested exhaustively, and this one had nothing.
export const SCANNER_KILLED = [
  '\n[gitleaks] gitleaks was killed before it could answer; the commit is blocked.\n',
  '\nThe binary is installed -- it started and died, so nothing was scanned. That is not a',
  'clean tree, and this hook will not report one. Re-run the commit; if it keeps dying, check',
  'for an OOM kill.\n',
].join('\n');

export function decideStagedExit(res) {
  if (res.error !== undefined) {
    return { block: true, reason: `${MISSING_BINARY}\n(${res.error.message})\n` };
  }
  if (res.status === null) {
    return { block: true, reason: SCANNER_KILLED };
  }
  if (res.status === LEAKS_FOUND) {
    return { block: true, reason: SECRET_STAGED };
  }
  if (res.status !== NO_LEAKS) {
    return {
      block: true,
      reason: `\n[gitleaks] exited ${res.status}, which is neither ${NO_LEAKS} (clean) nor ${LEAKS_FOUND} (leaks found). A malformed .gitleaks.toml exits non-zero, and reading an unknown exit code as "clean" is exactly how a secret gate goes green while scanning nothing.\n`,
    };
  }
  return { block: false };
}

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const GITLEAKS_BIN = process.env.GITLEAKS_BIN ?? 'gitleaks';

function main() {
  const res = spawnSync(
    GITLEAKS_BIN,
    ['git', '--staged', '--no-banner', '--redact', '--config', '.gitleaks.toml'],
    { stdio: 'inherit' },
  );

  const verdict = decideStagedExit(res);
  if (verdict.block) {
    console.error(verdict.reason);
    process.exitCode = 1;
  }
}

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
