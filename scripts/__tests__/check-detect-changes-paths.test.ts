import { describe, expect, it } from 'vitest';
import { assertResolves, classifyPathspec, globMatches } from '../check-detect-changes-paths.mjs';

describe('classifyPathspec', () => {
  it('classifies literal, glob, and exclude pathspecs with the right base', () => {
    expect(classifyPathspec('lib/ask/')).toEqual({ kind: 'literal', base: 'lib/ask/' });
    expect(classifyPathspec('__tests__/ask-*')).toEqual({ kind: 'glob', base: '__tests__/ask-*' });
    expect(classifyPathspec(':(exclude)lib/eval/**')).toEqual({
      kind: 'exclude',
      base: 'lib/eval',
    });
    expect(classifyPathspec(':(exclude)lib/__tests__/**')).toEqual({
      kind: 'exclude',
      base: 'lib/__tests__',
    });
  });
});

describe('globMatches', () => {
  const fs = { existsSync: () => true, readdirSync: () => ['ask-a.test.ts', 'other.test.ts'] };
  it('matches when >=1 entry shares the prefix', () => {
    expect(globMatches('__tests__/ask-*', fs)).toBe(true);
  });
  it('does not match when no entry shares the prefix', () => {
    expect(globMatches('__tests__/zzz-*', fs)).toBe(false);
  });
  it('does not match when the directory is missing', () => {
    expect(globMatches('__tests__/ask-*', { existsSync: () => false, readdirSync: () => [] })).toBe(
      false,
    );
  });
});

describe('assertResolves', () => {
  it('passes a literal whose path exists', () => {
    expect(assertResolves('lib/ask/', { existsSync: () => true })).toEqual({ ok: true });
  });
  it('fails a literal whose path is missing (the orphaned-filter case)', () => {
    const v = assertResolves('lib/moved/', { existsSync: () => false });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('literal');
  });
  it('fails a glob with no matches', () => {
    const v = assertResolves('__tests__/zzz-*', {
      existsSync: () => true,
      readdirSync: () => ['a'],
    });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('glob');
  });
  it('fails a stale exclude whose base is gone', () => {
    const v = assertResolves(':(exclude)lib/eval/**', { existsSync: () => false });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('exclude');
  });
});
