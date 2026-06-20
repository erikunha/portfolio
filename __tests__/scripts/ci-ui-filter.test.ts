import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ci = readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8');

// Extract the full `<var>=$(git diff ... )` assignment in detect-changes. Balances
// parens from the opening `$(` so `:(exclude)<path>` pathspecs (which contain their
// own parens) don't truncate the slice at the wrong ')'.
function gitDiffPaths(varName: string): string {
  const start = ci.indexOf(`${varName}=$(git diff`);
  if (start === -1) throw new Error(`${varName} assignment not found in ci.yml`);
  let depth = 0;
  let i = ci.indexOf('$(', start) + 1; // index of the opening '('
  for (; i < ci.length; i++) {
    if (ci[i] === '(') depth++;
    else if (ci[i] === ')' && --depth === 0) break;
  }
  return ci.slice(start, i);
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

  it('excludes lib/eval and lib tests from the ui filter (harness/tests never render)', () => {
    // lib/ is gated (it holds render-affecting runtime code), but lib/eval/ is
    // eval-harness code and lib/__tests__/ is unit tests — neither changes a pixel,
    // yet both would otherwise trip the visual suite + spurious Argos on every
    // agent-eval sub-PR. They are carved out via :(exclude) pathspecs.
    expect(ui).toMatch(/:\(exclude\)lib\/eval\/\*\*/);
    expect(ui).toMatch(/:\(exclude\)lib\/__tests__\/\*\*/);
    // The carve-out is surgical: lib/ itself stays in the gated list.
    expect(ui).toMatch(/\blib\/\s/);
  });

  it('re-arms `ui` via a semantic jq compare of package.json render fields', () => {
    // Structural: the gate compares ONLY {browserslist, pnpm} with jq (not a line-
    // grep, which misses array-element edits) and ORs the result into the decision.
    expect(ci).toMatch(/jq -cS '\{browserslist,pnpm\}'/);
    expect(ci).toMatch(/-n "\$ui_changed" \|\| -n "\$ui_pkg_changed"/);
  });
});

describe('ci.yml detect-changes `ai` filter (ask-eval calibration/corpus gate)', () => {
  const ai = gitDiffPaths('ai_changed');

  it('watches lib/eval/ so a change to the shared judge core triggers the ai gate', () => {
    // judge()/JUDGE_SYSTEM + the calibration runner were extracted out of
    // scripts/ask-eval.ts into lib/eval/. ask-eval.ts now IMPORTS them, so a PR
    // that edits only lib/eval/judge.ts (e.g. the judge prompt or retry logic)
    // changes the graded behavior. Without lib/eval/ in this pathspec that PR
    // sets ai=false and the calibration+corpus gate skips — a judge regression
    // would ship unguarded.
    expect(ai).toMatch(/\blib\/eval\//);
  });

  it('still watches scripts/ask-eval.ts (the gate entrypoint)', () => {
    expect(ai).toMatch(/\bscripts\/ask-eval\.ts\b/);
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
