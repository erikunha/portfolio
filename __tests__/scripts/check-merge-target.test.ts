import { describe, expect, it, vi } from 'vitest';
import {
  decideMergeTarget,
  evaluateMergeTarget,
  resolvePrNumber,
} from '@/scripts/check-merge-target';

function mockGh(baseRefName: string) {
  return vi.fn(async (_args: string[]) => `${baseRefName}\n`);
}

describe('decideMergeTarget (fail-closed merge target decision)', () => {
  it('REFUSES a PR whose base is main', () => {
    const r = decideMergeTarget('main');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('base_is_main');
  });

  it('allows a PR whose base is the feat/terminal-redesign integration branch', () => {
    const r = decideMergeTarget('feat/terminal-redesign');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.baseRefName).toBe('feat/terminal-redesign');
  });

  it('allows a PR whose base is any other non-main ref', () => {
    for (const base of ['feat/other-part', 'fix/something', 'develop']) {
      expect(decideMergeTarget(base).ok, `base=${base}`).toBe(true);
    }
  });

  it('REFUSES an empty or whitespace base ref (cannot prove the base is not main)', () => {
    for (const base of ['', '   ']) {
      const r = decideMergeTarget(base);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('empty_base');
    }
  });
});

describe('evaluateMergeTarget', () => {
  it('reads the base through gh pr view with --json baseRefName', async () => {
    const ghExec = mockGh('feat/terminal-redesign');
    const result = await evaluateMergeTarget({ prNumber: 42, ghExec });
    expect(result.ok).toBe(true);
    expect(ghExec.mock.calls[0]?.[0]).toEqual([
      'pr',
      'view',
      '42',
      '--json',
      'baseRefName',
      '-q',
      '.baseRefName',
    ]);
  });

  it('refuses when gh reports a main base', async () => {
    const result = await evaluateMergeTarget({ prNumber: 42, ghExec: mockGh('main') });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('base_is_main');
  });

  it('fails closed with code gh_failure when gh itself errors', async () => {
    const ghExec = vi.fn(async () => {
      throw new Error('gh: auth required');
    });
    const result = await evaluateMergeTarget({ prNumber: 42, ghExec });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('gh_failure');
  });
});

describe('resolvePrNumber', () => {
  it('accepts a bare number, a #N form and a pull request URL without calling gh', async () => {
    const ghExec = vi.fn(async () => {
      throw new Error('gh must not be called when the argument parses');
    });
    await expect(resolvePrNumber('42', ghExec)).resolves.toBe(42);
    await expect(resolvePrNumber('#42', ghExec)).resolves.toBe(42);
    await expect(
      resolvePrNumber('https://github.com/erikunha/portfolio/pull/329', ghExec),
    ).resolves.toBe(329);
  });

  it('infers the PR number from the current branch through gh when no argument parses', async () => {
    const ghExec = vi.fn(async (_args: string[]) => '7\n');
    await expect(resolvePrNumber(undefined, ghExec)).resolves.toBe(7);
    expect(ghExec.mock.calls[0]?.[0]).toEqual(['pr', 'view', '--json', 'number', '-q', '.number']);
  });

  it('throws when gh cannot infer a PR number', async () => {
    const ghExec = vi.fn(async (_args: string[]) => 'not-a-number\n');
    await expect(resolvePrNumber(undefined, ghExec)).rejects.toThrow(/could not infer PR number/);
  });

  it('throws on an unparsable argument instead of silently inferring a different PR', async () => {
    const ghExec = vi.fn(async (_args: string[]) => '7\n');
    await expect(resolvePrNumber('42x', ghExec)).rejects.toThrow(/could not parse PR number/);
    expect(ghExec).not.toHaveBeenCalled();
  });

  it('treats an empty argument as absent and infers from the current branch', async () => {
    const ghExec = vi.fn(async (_args: string[]) => '7\n');
    await expect(resolvePrNumber('', ghExec)).resolves.toBe(7);
  });
});
