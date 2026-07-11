import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalJSON, computeCategories } from '../../scripts/detect-changes.mjs';
import { AI_PATHS, APP_PATHS, UI_PATHS } from '../../scripts/detect-changes-paths.mjs';

describe('detect-changes-paths manifest: `ui` filter (visual / Argos gate)', () => {
  it('excludes package.json so a script-only edit does not trip the visual suite', () => {
    expect(UI_PATHS).not.toContain('package.json');
  });

  it('still includes pnpm-lock.yaml so UI-affecting dependency bumps are caught', () => {
    expect(UI_PATHS).toContain('pnpm-lock.yaml');
  });

  it('keeps package.json in the broader `app` filter (build/e2e/perf still gate on it)', () => {
    expect(APP_PATHS).toContain('package.json');
  });

  it('excludes lib/eval and lib tests from the ui filter (harness/tests never render)', () => {
    expect(UI_PATHS).toContain(':(exclude)lib/eval/**');
    expect(UI_PATHS).toContain(':(exclude)lib/__tests__/**');
    expect(UI_PATHS).toContain('lib/');
  });

  it('re-arms `ui` via a semantic compare of package.json render fields', () => {
    expect(
      computeCategories({
        aiChanged: false,
        appChanged: false,
        uiChanged: false,
        pkgRenderChanged: true,
      }),
    ).toMatchObject({ ui: true });
    expect(
      computeCategories({
        aiChanged: false,
        appChanged: false,
        uiChanged: false,
        pkgRenderChanged: false,
      }),
    ).toMatchObject({ ui: false });
  });
});

describe('detect-changes-paths manifest: `ai` filter (ask-eval calibration/corpus gate)', () => {
  it('watches lib/eval/ so a change to the shared judge core triggers the ai gate', () => {
    expect(AI_PATHS).toContain('lib/eval/');
  });

  it('still watches scripts/ask-eval.ts (the gate entrypoint)', () => {
    expect(AI_PATHS).toContain('scripts/ask-eval.ts');
  });
});

function renderProjection(pkg: Record<string, unknown>): string {
  return canonicalJSON({ browserslist: pkg.browserslist ?? null, pnpm: pkg.pnpm ?? null });
}

describe('ui re-arm: {browserslist, pnpm} projection discrimination', () => {
  const pkg = JSON.parse(readFileSync(`${process.cwd()}/package.json`, 'utf8'));
  const base = renderProjection(pkg);
  const browserslist = pkg.browserslist as string[];

  it('detects a browserslist array-ELEMENT edit (the case a line-grep misses)', () => {
    const edited = structuredClone(pkg);
    edited.browserslist = [`${browserslist[0]} `, ...browserslist.slice(1)];
    expect(renderProjection(edited)).not.toBe(base);
  });

  it('detects a pnpm.overrides edit', () => {
    const edited = structuredClone(pkg);
    const pnpm = pkg.pnpm as { overrides?: Record<string, string> };
    edited.pnpm = { ...pnpm, overrides: { ...pnpm.overrides, 'a-new-pin': '>=1.0.0' } };
    expect(renderProjection(edited)).not.toBe(base);
  });

  it('ignores a scripts-only edit (no spurious visual run)', () => {
    const edited = structuredClone(pkg);
    edited.scripts = { ...(pkg.scripts as object), 'x:probe': 'echo hi' };
    expect(renderProjection(edited)).toBe(base);
  });
});
