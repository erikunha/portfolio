import { describe, expect, it } from 'vitest';
import { inheritedEnvWithIsolatedGit } from '../../__tests__/helpers/hermetic-git';
import { canonicalJSON } from '../detect-changes.mjs';

describe('canonicalJSON', () => {
  it('sorts object keys recursively (key order does not matter)', () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toBe(canonicalJSON({ a: 2, b: 1 }));
    expect(canonicalJSON({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
  });

  it('preserves array order (order DOES matter for browserslist)', () => {
    expect(canonicalJSON(['chrome >= 95', 'firefox'])).toBe('["chrome >= 95","firefox"]');
    expect(canonicalJSON(['chrome >= 95', 'firefox'])).not.toBe(
      canonicalJSON(['firefox', 'chrome >= 95']),
    );
  });

  it('serializes null and (the null-fill hazard) treats undefined as null', () => {
    expect(canonicalJSON({ browserslist: null, pnpm: null })).toBe(
      '{"browserslist":null,"pnpm":null}',
    );
    expect(canonicalJSON({ x: undefined })).toBe('{"x":null}');
  });

  it('is whitespace-free for nested structures', () => {
    expect(canonicalJSON({ pnpm: { overrides: { zod: '4.4.3' } } })).toBe(
      '{"pnpm":{"overrides":{"zod":"4.4.3"}}}',
    );
  });
});

import { aiMajor, computeCategories } from '../detect-changes.mjs';

describe('computeCategories', () => {
  const S = (
    o: Partial<
      Record<
        'aiChanged' | 'appChanged' | 'uiChanged' | 'pkgRenderChanged' | 'aiMajorChanged',
        boolean
      >
    >,
  ) => ({
    aiChanged: false,
    appChanged: false,
    uiChanged: false,
    pkgRenderChanged: false,
    aiMajorChanged: false,
    ...o,
  });

  it('maps ai/app straight through and ui = uiChanged || pkgRenderChanged', () => {
    expect(computeCategories(S({ aiChanged: true }))).toEqual({ ai: true, app: false, ui: false });
    expect(computeCategories(S({ appChanged: true }))).toEqual({ ai: false, app: true, ui: false });
    expect(computeCategories(S({ uiChanged: true }))).toEqual({ ai: false, app: false, ui: true });
  });

  it('re-arms ui from pkgRenderChanged alone (browserslist/pnpm bump, no other ui diff)', () => {
    expect(computeCategories(S({ appChanged: true, pkgRenderChanged: true }))).toEqual({
      ai: false,
      app: true,
      ui: true,
    });
  });

  it('re-arms ai from aiMajorChanged alone (a deps-only `ai` MAJOR bump — the #170 incident class)', () => {
    expect(computeCategories(S({ appChanged: true, aiMajorChanged: true }))).toEqual({
      ai: true,
      app: true,
      ui: false,
    });
  });

  it('does NOT re-arm ai for a minor/patch `ai` bump (aiMajorChanged false — credits preserved)', () => {
    expect(computeCategories(S({ appChanged: true, pkgRenderChanged: false }))).toEqual({
      ai: false,
      app: true,
      ui: false,
    });
  });

  it('all-false yields all-false (docs-only PR)', () => {
    expect(computeCategories(S({}))).toEqual({ ai: false, app: false, ui: false });
  });
});

describe('aiMajor (extract the `ai` dependency major from a package.json string)', () => {
  const pkg = (aiSpec?: string, where: 'dependencies' | 'devDependencies' = 'dependencies') =>
    JSON.stringify(aiSpec === undefined ? {} : { [where]: { ai: aiSpec } });

  it('extracts the major from caret/tilde/range/exact specifiers', () => {
    expect(aiMajor(pkg('^7.0.14'))).toBe(7);
    expect(aiMajor(pkg('~6.0.208'))).toBe(6);
    expect(aiMajor(pkg('>=7.0.0'))).toBe(7);
    expect(aiMajor(pkg('6.0.208'))).toBe(6);
  });

  it('finds `ai` in devDependencies too', () => {
    expect(aiMajor(pkg('^7.1.0', 'devDependencies'))).toBe(7);
  });

  it('returns null when `ai` is absent or the specifier is unparseable', () => {
    expect(aiMajor(pkg(undefined))).toBeNull();
    expect(aiMajor(pkg('workspace:*'))).toBeNull();
    expect(aiMajor(pkg('latest'))).toBeNull();
  });

  it('returns null on malformed JSON (fail-safe: a null that differs from the other ref over-arms)', () => {
    expect(aiMajor('{not json')).toBeNull();
  });

  it('a 6->7 change yields different majors (drives aiMajorChanged=true)', () => {
    expect(aiMajor(pkg('^6.0.208'))).not.toBe(aiMajor(pkg('^7.0.14')));
  });

  it('honors pnpm.overrides.ai with PRECEDENCE (closes the override-bypass class)', () => {
    const withOverride = JSON.stringify({
      dependencies: { ai: '^6.0.208' },
      pnpm: { overrides: { ai: '7.0.0' } },
    });
    const noOverride = JSON.stringify({ dependencies: { ai: '^6.0.208' } });
    expect(aiMajor(withOverride)).toBe(7);
    expect(aiMajor(noOverride)).toBe(6);
    expect(aiMajor(withOverride)).not.toBe(aiMajor(noOverride));
  });
});

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe('runner main() via subprocess', () => {
  const runner = resolve(process.cwd(), 'scripts/detect-changes.mjs');

  it('non-PR event writes ai=true app=true ui=true and exits 0', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dc-nonpr-'));
    try {
      const out = join(dir, 'gh_output');
      execFileSync('node', [runner], {
        env: inheritedEnvWithIsolatedGit({ EVENT_NAME: 'push', GITHUB_OUTPUT: out }),
      });
      expect(readFileSync(out, 'utf8')).toBe('ai=true\napp=true\nui=true\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails closed on a git error: exits 1 and writes NO output (never a partial line)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dc-failclosed-'));
    try {
      const out = join(dir, 'gh_output');
      writeFileSync(out, '');
      let code = 0;
      try {
        execFileSync('node', [runner], {
          stdio: 'pipe',
          env: inheritedEnvWithIsolatedGit({
            EVENT_NAME: 'pull_request',
            BASE_SHA: '0000000000000000000000000000000000000000',
            HEAD_SHA: '0000000000000000000000000000000000000000',
            GITHUB_OUTPUT: out,
          }),
        });
      } catch (err) {
        code = (err as { status?: number }).status ?? -1;
      }
      expect(code).toBe(1);
      expect(readFileSync(out, 'utf8')).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('re-arms ai=true when a deps-only commit bumps the `ai` MAJOR (6->7)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dc-aimajor-'));
    const git = (...args: string[]) =>
      execFileSync('git', args, {
        cwd: dir,
        encoding: 'utf8',
        env: inheritedEnvWithIsolatedGit(),
      }).trim();
    try {
      git('init', '-b', 'main');
      git('config', 'user.email', 't@t.dev');
      git('config', 'user.name', 't');
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ dependencies: { ai: '^6.0.208' } }),
      );
      git('add', '-A');
      git('commit', '-m', 'base');
      const base = git('rev-parse', 'HEAD');
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { ai: '^7.0.14' } }));
      git('add', '-A');
      git('commit', '-m', 'bump ai 6->7');
      const head = git('rev-parse', 'HEAD');

      const out = join(dir, 'gh_output');
      execFileSync('node', [runner], {
        cwd: dir,
        env: inheritedEnvWithIsolatedGit({
          EVENT_NAME: 'pull_request',
          BASE_SHA: base,
          HEAD_SHA: head,
          GITHUB_OUTPUT: out,
        }),
      });
      expect(readFileSync(out, 'utf8')).toBe('ai=true\napp=true\nui=false\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
