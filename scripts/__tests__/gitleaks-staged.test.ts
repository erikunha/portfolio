import { describe, expect, it } from 'vitest';
import { decideStagedExit, LEAKS_FOUND, NO_LEAKS } from '../gitleaks-staged.mjs';

const FATAL = 2;

const FAIL_CLOSED =
  'This runs on EVERY commit and is the only thing standing between a secret and git history. Once a secret is committed and pushed it is published, and rotation is the only remedy — so a branch here that lets the commit through is not a bug, it is the leak.';

describe('decideStagedExit (the pre-commit gate cannot let a commit through unless gitleaks really scanned)', () => {
  // The literals, not the constants. Feeding NO_LEAKS/LEAKS_FOUND back in would make these
  // tautological: swap the two constants and every test still passes, while in production
  // gitleaks' real exit 1 ("secret found") would read as clean and the commit would ship the
  // secret. The exit codes are a claim about an EXTERNAL tool, so a test that consumes the
  // claim cannot verify it. (Test files are exempt from the no-magic-values rule, and here the
  // literal IS the point.)
  it('gitleaks exit 0 -- and only exit 0 -- lets the commit through', () => {
    expect(decideStagedExit({ status: 0 }).block, FAIL_CLOSED).toBe(false);
    expect(NO_LEAKS, 'NO_LEAKS must be the exit code gitleaks returns for a clean tree').toBe(0);
  });

  it('gitleaks exit 1 (a secret in the staged changes) blocks the commit', () => {
    const verdict = decideStagedExit({ status: 1 });
    expect(verdict.block, FAIL_CLOSED).toBe(true);
    expect(verdict.reason).toContain('the commit is blocked');
    expect(
      LEAKS_FOUND,
      'LEAKS_FOUND must be the exit code gitleaks returns when it finds a secret. If this constant drifts, a real finding is read as clean and the commit ships the secret.',
    ).toBe(1);
  });

  it('a missing gitleaks binary BLOCKS, and says how to install it', () => {
    const verdict = decideStagedExit({
      error: new Error('spawnSync gitleaks ENOENT'),
      status: null,
    });
    expect(
      verdict.block,
      `${FAIL_CLOSED}\n\nA scanner that silently skips when it is not installed is the same as no scanner, and nobody would ever find out — which is precisely the state this repo was in before this gate existed.`,
    ).toBe(true);
    expect(verdict.reason).toContain('brew install gitleaks');
    expect(verdict.reason).toContain('ENOENT');
  });

  it('gitleaks killed by a signal BLOCKS, and the reason names the kill -- not a missing binary', () => {
    const verdict = decideStagedExit({ status: null });
    expect(verdict.block, FAIL_CLOSED).toBe(true);
    expect(
      verdict.reason,
      'Asserting only `block` lets the did-not-run branch be deleted: the result falls through to the unknown-exit-code branch, which also blocks, so no test notices — while the message degrades to "exited null", which names nothing.',
    ).toContain('killed');
    expect(
      verdict.reason,
      'A killed scanner is not a missing one. Telling the developer to `brew install gitleaks` when the binary is installed and was OOM-killed sends them to fix the wrong thing — the same message-contradiction class this PR keeps closing.',
    ).not.toContain('brew install');
    expect(verdict.reason).not.toContain('null');
  });

  it('an unknown exit code BLOCKS, never reads as clean', () => {
    const verdict = decideStagedExit({ status: FATAL });
    expect(
      verdict.block,
      `${FAIL_CLOSED}\n\nA malformed .gitleaks.toml exits non-zero. Mapping that onto "clean" would mean a broken config silently disables the local gate.`,
    ).toBe(true);
    expect(verdict.reason).toContain(String(FATAL));
  });

  it('the false-positive guidance does not tell the developer to use a paths allowlist', () => {
    const verdict = decideStagedExit({ status: LEAKS_FOUND });
    expect(
      verdict.reason,
      'This message is read at the exact moment a developer decides HOW to allowlist. It previously told them to add a `paths` entry — which exempts that file from EVERY rule and makes it a permanent secret-laundering path. The hook was instructing them to recreate the vulnerability.',
    ).toContain('Never a `paths` entry');
  });
});
