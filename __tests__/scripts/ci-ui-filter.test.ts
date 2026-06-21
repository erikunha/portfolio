// These tests replaced the original ci.yml shell-parsing approach after the
// inline detect-changes shell was migrated to scripts/detect-changes.mjs +
// scripts/detect-changes-paths.mjs (Tasks 1-5 of the detect-changes hardening
// plan). The source of truth is now the manifest, not the ci.yml text.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalJSON, computeCategories } from '../../scripts/detect-changes.mjs';
import { AI_PATHS, APP_PATHS, UI_PATHS } from '../../scripts/detect-changes-paths.mjs';

describe('detect-changes-paths manifest: `ui` filter (visual / Argos gate)', () => {
  it('excludes package.json so a script-only edit does not trip the visual suite', () => {
    // A scripts-only package.json change cannot alter a rendered pixel; including it
    // ran the visual suite on workflow-only PRs and reported spurious Argos "N added".
    expect(UI_PATHS).not.toContain('package.json');
  });

  it('still includes pnpm-lock.yaml so UI-affecting dependency bumps are caught', () => {
    // A dependency bump that can change rendering always changes the lockfile.
    expect(UI_PATHS).toContain('pnpm-lock.yaml');
  });

  it('keeps package.json in the broader `app` filter (build/e2e/perf still gate on it)', () => {
    expect(APP_PATHS).toContain('package.json');
  });

  it('excludes lib/eval and lib tests from the ui filter (harness/tests never render)', () => {
    // lib/ is gated (it holds render-affecting runtime code), but lib/eval/ is
    // eval-harness code and lib/__tests__/ is unit tests -- neither changes a pixel,
    // yet both would otherwise trip the visual suite + spurious Argos on every
    // agent-eval sub-PR. They are carved out via :(exclude) pathspecs.
    expect(UI_PATHS).toContain(':(exclude)lib/eval/**');
    expect(UI_PATHS).toContain(':(exclude)lib/__tests__/**');
    // The carve-out is surgical: lib/ itself stays in the gated list.
    expect(UI_PATHS).toContain('lib/');
  });

  it('re-arms `ui` via a semantic compare of package.json render fields', () => {
    // Structural: computeCategories ORs uiChanged with pkgRenderChanged, so a
    // scripts-only package.json edit that leaves browserslist/pnpm unchanged does
    // NOT trip the visual suite, but a browserslist or pnpm.overrides change does.
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
    // judge()/JUDGE_SYSTEM + the calibration runner were extracted out of
    // scripts/ask-eval.ts into lib/eval/. ask-eval.ts now IMPORTS them, so a PR
    // that edits only lib/eval/judge.ts (e.g. the judge prompt or retry logic)
    // changes the graded behavior. Without lib/eval/ in this pathspec that PR
    // sets ai=false and the calibration+corpus gate skips -- a judge regression
    // would ship unguarded.
    expect(AI_PATHS).toContain('lib/eval/');
  });

  it('still watches scripts/ask-eval.ts (the gate entrypoint)', () => {
    expect(AI_PATHS).toContain('scripts/ask-eval.ts');
  });
});

// Behavioral: prove the {browserslist, pnpm} projection the CI gate compares actually
// discriminates a rendering-relevant edit from a scripts-only edit. This is the load-
// bearing property -- a line-grep failed exactly here (a browserslist array-element
// edit changes a line that does not contain the key name).
function renderProjection(pkg: Record<string, unknown>): string {
  return canonicalJSON({ browserslist: pkg.browserslist ?? null, pnpm: pkg.pnpm ?? null });
}

describe('ui re-arm: {browserslist, pnpm} projection discrimination', () => {
  const pkg = JSON.parse(readFileSync(`${process.cwd()}/package.json`, 'utf8'));
  const base = renderProjection(pkg);
  const browserslist = pkg.browserslist as string[];

  it('detects a browserslist array-ELEMENT edit (the case a line-grep misses)', () => {
    const edited = structuredClone(pkg);
    // Edit the first element's value, not the `browserslist` key line.
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
