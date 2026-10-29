import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inheritedEnvWithIsolatedGit } from '../../__tests__/helpers/hermetic-git';
import { computeCategories } from '../detect-changes.mjs';
import { AI_PATHS, APP_PATHS, UI_PATHS } from '../detect-changes-paths.mjs';

describe('detect-changes manifest', () => {
  it('exports non-empty path arrays (anti-vacuous)', () => {
    expect(AI_PATHS.length).toBeGreaterThan(0);
    expect(APP_PATHS.length).toBeGreaterThan(0);
    expect(UI_PATHS.length).toBeGreaterThan(0);
  });

  it('keeps the load-bearing anchor pathspecs (guards against a truncated copy)', () => {
    expect(AI_PATHS).toContain('lib/eval/');
    expect(AI_PATHS).toContain('__tests__/ask-*');
    expect(APP_PATHS).toContain('.github/workflows/');
    expect(APP_PATHS).toContain('package.json');
    expect(UI_PATHS).toContain(':(exclude)lib/eval/**');
    expect(UI_PATHS).toContain(':(exclude)lib/__tests__/**');
  });

  it('keeps ui a subset of app for the literal (non-exclude, non-pkg) entries', () => {
    const literal = (xs: readonly string[]) =>
      xs.filter((p) => !p.startsWith(':(exclude)') && p !== 'package.json');
    for (const p of literal(UI_PATHS)) expect(APP_PATHS).toContain(p);
  });
});

describe('test-only diffs', () => {
  it.each(['tests/visual/visual.spec.ts-snapshots/x.png', 'tests/e2e/contact.spec.ts'])(
    'runs UI and app gates for %s alone',
    (path) => {
      const dir = mkdtempSync(join(tmpdir(), 'dc-test-path-'));
      const git = (...args: string[]) =>
        execFileSync('git', args, {
          cwd: dir,
          env: inheritedEnvWithIsolatedGit(),
          encoding: 'utf8',
        }).trim();
      try {
        git('init', '--quiet');
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), 'fixture');
        git('add', '--', path);
        const changed = (paths: readonly string[]) =>
          Boolean(git('diff', '--cached', '--name-only', '--', ...paths));
        expect(
          computeCategories({
            aiChanged: changed(AI_PATHS),
            appChanged: changed(APP_PATHS),
            uiChanged: changed(UI_PATHS),
            pkgRenderChanged: false,
          }),
        ).toEqual({ ai: false, app: true, ui: true });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
