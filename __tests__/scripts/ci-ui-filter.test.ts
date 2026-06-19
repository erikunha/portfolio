import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ci = readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8');

// Extract the path list of a `<var>=$(git diff ... )` assignment in detect-changes.
// The first ')' after the assignment closes the command substitution; none of the
// paths or the `"$BASE_SHA...$HEAD_SHA"` range contain a ')'.
function gitDiffPaths(varName: string): string {
  const start = ci.indexOf(`${varName}=$(git diff`);
  if (start === -1) throw new Error(`${varName} assignment not found in ci.yml`);
  const end = ci.indexOf(')', start);
  return ci.slice(start, end);
}

describe('ci.yml detect-changes `ui` filter (visual / Argos gate)', () => {
  const ui = gitDiffPaths('ui_changed');
  const app = gitDiffPaths('app_changed');

  it('excludes package.json so a script-only edit does not trip the visual suite', () => {
    // A scripts-only package.json change cannot alter a rendered pixel; including it
    // ran the visual suite on workflow-only PRs and reported spurious Argos "N added".
    expect(ui).not.toMatch(/\bpackage\.json\b/);
  });

  it('still includes pnpm-lock.yaml so UI-affecting dependency bumps are caught', () => {
    // A dependency bump that can change rendering always changes the lockfile.
    expect(ui).toMatch(/\bpnpm-lock\.yaml\b/);
  });

  it('keeps package.json in the broader `app` filter (build/e2e/perf still gate on it)', () => {
    expect(app).toMatch(/\bpackage\.json\b/);
  });

  it('re-arms `ui` via a semantic jq compare of package.json render fields', () => {
    // Structural: the gate compares ONLY {browserslist, pnpm} with jq (not a line-
    // grep, which misses array-element edits) and ORs the result into the decision.
    expect(ci).toMatch(/jq -cS '\{browserslist,pnpm\}'/);
    expect(ci).toMatch(/-n "\$ui_changed" \|\| -n "\$ui_pkg_changed"/);
  });
});

// Behavioral: prove the {browserslist, pnpm} projection the CI gate compares actually
// discriminates a rendering-relevant edit from a scripts-only edit. This is the load-
// bearing property — a line-grep failed exactly here (a browserslist array-element
// edit changes a line that does not contain the key name).
function renderProjection(pkg: Record<string, unknown>): string {
  return JSON.stringify({ browserslist: pkg.browserslist ?? null, pnpm: pkg.pnpm ?? null });
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
