import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  assertResolves,
  classifyPathspec,
  globMatches,
  isGateScoped,
  unclassifiedFiles,
} from '../check-detect-changes-paths.mjs';
import { AI_PATHS, APP_PATHS, IGNORED_PATHS, UI_PATHS } from '../detect-changes-paths.mjs';

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

describe('unclassifiedFiles (fail closed for new root and scripts files)', () => {
  it('flags a root file and a scripts file that no filter or ignore entry covers', () => {
    expect(unclassifiedFiles(['brand-new.config.ts', 'scripts/brand-new.mjs'])).toEqual([
      'brand-new.config.ts',
      'scripts/brand-new.mjs',
    ]);
  });

  it('ignores files outside the root and scripts scope', () => {
    expect(isGateScoped('docs/readme.md')).toBe(false);
    expect(unclassifiedFiles(['docs/readme.md'])).toEqual([]);
  });

  it.each([
    'proxy.ts',
    'instrumentation.ts',
    'vercel.json',
    'postcss.config.mjs',
    'tsconfig.json',
    '.nvmrc',
    'scripts/strip-next-polyfills.mjs',
  ])('arms the app filter for %s', (file) => {
    expect(APP_PATHS).toContain(file);
  });

  it('classifies every git-tracked root and scripts file', () => {
    const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
      .split('\0')
      .filter(Boolean);
    expect(unclassifiedFiles(tracked)).toEqual([]);
  });

  it('lists no ignore entry that also arms a filter', () => {
    const armed = [...AI_PATHS, ...APP_PATHS, ...UI_PATHS];
    expect(IGNORED_PATHS.filter((p) => armed.includes(p))).toEqual([]);
  });
});
