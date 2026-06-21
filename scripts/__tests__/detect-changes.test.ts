import { describe, expect, it } from 'vitest';
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
    // A naive JSON.stringify of { x: undefined } omits x; canonicalJSON must emit null.
    expect(canonicalJSON({ x: undefined })).toBe('{"x":null}');
  });

  it('is whitespace-free for nested structures', () => {
    expect(canonicalJSON({ pnpm: { overrides: { zod: '4.4.3' } } })).toBe(
      '{"pnpm":{"overrides":{"zod":"4.4.3"}}}',
    );
  });
});

import { computeCategories } from '../detect-changes.mjs';

describe('computeCategories', () => {
  const S = (
    o: Partial<Record<'aiChanged' | 'appChanged' | 'uiChanged' | 'pkgRenderChanged', boolean>>,
  ) => ({
    aiChanged: false,
    appChanged: false,
    uiChanged: false,
    pkgRenderChanged: false,
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

  it('all-false yields all-false (docs-only PR)', () => {
    expect(computeCategories(S({}))).toEqual({ ai: false, app: false, ui: false });
  });
});

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe('runner main() via subprocess', () => {
  // import.meta.url is unreliable in Vitest jsdom; use cwd-relative path instead.
  const runner = resolve(process.cwd(), 'scripts/detect-changes.mjs');

  it('non-PR event writes ai=true app=true ui=true and exits 0', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dc-nonpr-'));
    try {
      const out = join(dir, 'gh_output');
      execFileSync('node', [runner], {
        env: { ...process.env, EVENT_NAME: 'push', GITHUB_OUTPUT: out },
      });
      expect(readFileSync(out, 'utf8')).toBe('ai=true\napp=true\nui=true\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails closed on a git error: exits 1 and writes NO output (never a partial line)', () => {
    // A PR event with an unresolvable BASE_SHA makes `git diff` error. The runner
    // must exit non-zero with an EMPTY output file - a partial/empty `ai=` line
    // read as falsy downstream would silently skip a required gate (fail-open).
    const dir = mkdtempSync(join(tmpdir(), 'dc-failclosed-'));
    try {
      const out = join(dir, 'gh_output');
      writeFileSync(out, '');
      let code = 0;
      try {
        execFileSync('node', [runner], {
          stdio: 'pipe',
          env: {
            ...process.env,
            EVENT_NAME: 'pull_request',
            BASE_SHA: '0000000000000000000000000000000000000000',
            HEAD_SHA: '0000000000000000000000000000000000000000',
            GITHUB_OUTPUT: out,
          },
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
});
