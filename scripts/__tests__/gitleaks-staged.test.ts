import { describe, expect, it } from 'vitest';
import { decideStagedExit, LEAKS_FOUND, NO_LEAKS } from '../gitleaks-staged.mjs';

const FATAL = 2;

const FAIL_CLOSED =
  'This runs on EVERY commit and is the only thing standing between a secret and git history. Once a secret is committed and pushed it is published, and rotation is the only remedy — so a branch here that lets the commit through is not a bug, it is the leak.';

describe('decideStagedExit (the pre-commit gate cannot let a commit through unless gitleaks really scanned)', () => {
  it('a clean staged tree is the ONLY case that lets the commit through', () => {
    expect(decideStagedExit({ status: NO_LEAKS }).block).toBe(false);
  });

  it('a secret in the staged changes blocks the commit', () => {
    const verdict = decideStagedExit({ status: LEAKS_FOUND });
    expect(verdict.block, FAIL_CLOSED).toBe(true);
    expect(verdict.reason).toContain('the commit is blocked');
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

  it('gitleaks killed by a signal BLOCKS', () => {
    expect(decideStagedExit({ status: null }).block, FAIL_CLOSED).toBe(true);
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
