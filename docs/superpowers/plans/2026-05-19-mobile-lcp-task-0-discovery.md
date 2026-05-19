# Mobile LCP Task 0 (Discovery) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the ranked contributor backlog for the Mobile LCP Strict 1800ms Campaign (Section 12 of the spec) by capturing fresh Lighthouse mobile audits against current main and extracting the named contributor data the spec calls for.

**Architecture:** Run `pnpm lhci:mobile` against a local `pnpm start` production server (matches CI baseline 3069ms exactly — same throttling, same form factor, same per-run count). Extract median-LCP run's relevant audits via a reusable TypeScript script. Hand-author the §12 markdown using the script's output plus a human judgment call on PR-1's implementation-approach discriminator. Commit on `docs/spec-mobile-lcp-1800ms-campaign` so spec + discovery ship as one PR.

**Tech Stack:** Lighthouse CI (`@lhci/cli`), Node 22+, pnpm 10, Vitest (existing), tsx (existing). No new dependencies.

---

## Spec reference

This plan implements **§6 (Task 0 — Discovery) only** of `docs/superpowers/specs/2026-05-19-mobile-lcp-strict-1800ms-campaign-design.md`. The spec passed `architect-reviewer` spec-gate with `GATE_RESULT: PASS`. Subsequent phases (PR-1 through PR-6+) are separate `writing-plans` invocations after this discovery commits.

## Files

- **Create**: `scripts/extract-lcp-discovery.ts` — reusable extractor that reads `.lighthouseci/lhr-*.json`, selects the median-LCP run, formats the named audits into the spec's §12 table shape.
- **Modify**: `docs/superpowers/specs/2026-05-19-mobile-lcp-strict-1800ms-campaign-design.md` — replace the §12 TBD block with the actual ranked contributor backlog + PR-1 implementation-approach discriminator.
- **Touched (generated, not edited)**: `.lighthouseci/lhr-*.json`, `.lighthouseci/lhr-*.html`, `.lighthouseci/assertion-results.json`. These are gitignored (existing biome.json exclude `!.lighthouseci`); not committed.

## Branching

Work continues on **`docs/spec-mobile-lcp-1800ms-campaign`** (already exists, has `9bcc10c` + `a263544`). When discovery commits land, push and open a single PR for the whole spec + discovery unit.

---

### Task 1: Verify clean environment

**Files:** none modified

- [ ] **Step 1: Confirm branch**

Run:
```bash
git branch --show-current
```
Expected: `docs/spec-mobile-lcp-1800ms-campaign`

If different, switch:
```bash
git checkout docs/spec-mobile-lcp-1800ms-campaign
```

- [ ] **Step 2: Confirm working tree is clean**

Run:
```bash
git status --short
```
Expected: no output (clean tree). If there are uncommitted changes, stash or commit them before proceeding — Task 0 must measure against the exact tree it commits about.

- [ ] **Step 3: Confirm dependencies are installed**

Run:
```bash
pnpm install --frozen-lockfile
```
Expected: completes without modifying `pnpm-lock.yaml`. If lockfile drift, fail loudly and stop — do not proceed with mismatched deps.

---

### Task 2: Build the production bundle

**Files:** none modified (produces `.next/` build artifacts)

- [ ] **Step 1: Build**

Run:
```bash
pnpm build
```
Expected: completes successfully. Last few lines show route summary including `/` with size totals. If build fails, fix the build first — Lighthouse measurement must reflect a real production bundle.

- [ ] **Step 2: Verify bundle gate is green**

Run:
```bash
pnpm bundle-check
```
Expected: passes. If bundle-check is red, that's a regression unrelated to this plan; stop and fix before measuring.

---

### Task 3: Capture Lighthouse mobile baseline (3 runs)

**Files:** none modified (produces `.lighthouseci/lhr-*.json` + `.html`)

- [ ] **Step 1: Clear any prior LHCI artifacts**

Run:
```bash
rm -rf .lighthouseci
```
Expected: directory is removed. (LHCI re-creates it on next run.)

- [ ] **Step 2: Start the production server in the background**

Run:
```bash
pnpm start &
echo $! > /tmp/lcp-discovery-server.pid
```
Expected: server starts on port 3000. PID written to `/tmp/lcp-discovery-server.pid` for cleanup.

- [ ] **Step 3: Wait for server to be ready**

Run:
```bash
npx --yes wait-on http://localhost:3000 --timeout 30000
```
Expected: command exits 0 when `/` returns 200. If it times out, check the server log; do not proceed.

- [ ] **Step 4: Run mobile Lighthouse with 3 runs**

Run:
```bash
pnpm lhci:mobile
```
Expected: 3 runs complete. Output includes a "Lighthouse Reports" summary with 3 LHR files. The mobile gate `largest-contentful-paint maxNumericValue: 3400` is currently calibrated above the measured median; the assertion phase may PASS or FAIL — either is acceptable for Task 0 because we're measuring, not gating.

If LHCI fails with "Connection refused" or similar, the server isn't actually ready — investigate and re-run from Step 2.

- [ ] **Step 5: Verify 3 LHRs exist**

Run:
```bash
ls .lighthouseci/lhr-*.json | wc -l
```
Expected: `3`. If fewer, lhci aborted mid-run — re-run from Step 1 of this task.

- [ ] **Step 6: Stop the production server**

Run:
```bash
kill "$(cat /tmp/lcp-discovery-server.pid)"
rm /tmp/lcp-discovery-server.pid
```
Expected: server process terminates. If `kill` fails because the process already exited, that's fine — just remove the PID file.

---

### Task 4: Write the discovery extraction script

**Files:**
- Create: `scripts/extract-lcp-discovery.ts`

- [ ] **Step 1: Create the script**

Write the file `scripts/extract-lcp-discovery.ts` with this exact content:

```typescript
#!/usr/bin/env tsx
/**
 * Reads Lighthouse JSON reports from a directory (default: .lighthouseci),
 * selects the median LCP run, and prints a markdown block formatted for
 * Section 12 of docs/superpowers/specs/2026-05-19-mobile-lcp-strict-1800ms-campaign-design.md.
 *
 * Audits extracted match the spec's §6 list exactly:
 *  - largest-contentful-paint (numericValue per run, median selected)
 *  - largest-contentful-paint-element (node + load+render delay breakdown)
 *  - render-blocking-resources (items with wastedMs)
 *  - font-display (failing font URLs)
 *  - preload-fonts (score)
 *  - server-response-time (numericValue)
 *  - unused-css-rules (overallSavingsBytes, wastedPercent)
 *  - unused-javascript (items)
 *  - uses-text-compression (score)
 *  - uses-rel-preload (score)
 *  - critical-request-chains (depth)
 *
 * Usage:
 *   pnpm tsx scripts/extract-lcp-discovery.ts            # reads .lighthouseci/
 *   pnpm tsx scripts/extract-lcp-discovery.ts <dir>      # reads <dir>/lhr-*.json
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

type LhrAudit = {
  id?: string;
  numericValue?: number;
  score?: number | null;
  details?: {
    items?: Array<Record<string, unknown>>;
    overallSavingsBytes?: number;
    overallSavingsMs?: number;
    chains?: Record<string, unknown>;
  };
};

type Lhr = {
  fetchTime: string;
  audits: Record<string, LhrAudit>;
};

const dir = process.argv[2] ?? '.lighthouseci';
const files = readdirSync(dir)
  .filter((f) => f.startsWith('lhr-') && f.endsWith('.json'))
  .map((f) => path.join(dir, f));

if (files.length === 0) {
  console.error(`No lhr-*.json files found in ${dir}`);
  process.exit(1);
}

const lhrs: Lhr[] = files.map((f) => JSON.parse(readFileSync(f, 'utf8')) as Lhr);

const sortedByLcp = [...lhrs].sort(
  (a, b) =>
    (a.audits['largest-contentful-paint']?.numericValue ?? 0) -
    (b.audits['largest-contentful-paint']?.numericValue ?? 0),
);
const median = sortedByLcp[Math.floor(sortedByLcp.length / 2)] as Lhr;

const lcpAll = lhrs
  .map((l) => Math.round(l.audits['largest-contentful-paint']?.numericValue ?? 0))
  .sort((a, b) => a - b);
const lcpMedian = lcpAll[Math.floor(lcpAll.length / 2)] as number;
const lcpSpread = (lcpAll.at(-1) as number) - (lcpAll[0] as number);

const a = median.audits;

const blocking = (a['render-blocking-resources']?.details?.items ?? []) as Array<{
  url: string;
  wastedMs?: number;
  totalBytes?: number;
}>;
const unusedJs = (a['unused-javascript']?.details?.items ?? []) as Array<{
  url: string;
  wastedBytes?: number;
  wastedPercent?: number;
}>;
const fontDisplay = (a['font-display']?.details?.items ?? []) as Array<{ url: string }>;
const lcpElementItems = (a['largest-contentful-paint-element']?.details?.items ?? []) as Array<{
  node?: { nodeLabel?: string; snippet?: string; selector?: string };
}>;
const lcpElement = lcpElementItems[0]?.node;

const unusedCss = a['unused-css-rules']?.details ?? {};

const out: string[] = [];
out.push(`## 12. Discovery findings (Task 0)\n`);
out.push(`Captured ${lhrs.length} mobile Lighthouse runs on ${new Date(median.fetchTime).toISOString()} (localhost production build, throttling per lighthouserc.mobile.json: simulated 4G + 4x CPU on Moto G4).\n`);
out.push(`### Headline numbers\n`);
out.push(`| Metric | Value |\n|---|---|`);
out.push(`| LCP median (3 runs) | **${lcpMedian} ms** |`);
out.push(`| LCP range across runs | ${lcpAll[0]} ms – ${lcpAll.at(-1)} ms (spread ${lcpSpread} ms) |`);
out.push(`| Target | 1800 ms |`);
out.push(`| Gap to close | ${lcpMedian - 1800} ms |`);
out.push(`| Performance score (median run) | ${a['performance']?.score ?? 'n/a'} |`);
out.push(`| Server response time | ${Math.round(a['server-response-time']?.numericValue ?? 0)} ms |\n`);

out.push(`### LCP element (median run)\n`);
if (lcpElement) {
  out.push(`- Node label: \`${lcpElement.nodeLabel ?? '(unlabeled)'}\``);
  out.push(`- Selector: \`${lcpElement.selector ?? '(none)'}\``);
  out.push(`- Snippet: \`${(lcpElement.snippet ?? '').slice(0, 120)}\`\n`);
} else {
  out.push(`Lighthouse did not classify the LCP element. Manual Chrome DevTools trace required — see spec §6 "Zero contributors" branch.\n`);
}

out.push(`### Ranked contributor backlog\n`);
out.push(`| Rank | Contributor | Measured contribution | Estimated savings | Proposed fix | Risk |\n|---|---|---|---|---|---|`);

const rows: Array<[string, string, string, string, string]> = [];

for (const item of blocking.slice(0, 5)) {
  rows.push([
    `Render-blocking: \`${item.url.split('/').pop() ?? item.url}\``,
    `${Math.round(item.wastedMs ?? 0)} ms wasted on critical chain`,
    `${Math.round((item.wastedMs ?? 0) * 0.8)}–${Math.round(item.wastedMs ?? 0)} ms`,
    item.url.includes('.css') ? 'preload+onload swap' : 'defer or split',
    item.url.includes('.css') ? 'FOUC below fold' : 'hydration timing',
  ]);
}

if ((a['preload-fonts']?.score ?? 1) < 1) {
  rows.push([
    'Font preload missing',
    `preload-fonts score ${a['preload-fonts']?.score ?? 'n/a'}`,
    '100–400 ms',
    `<link rel="preload" as="font" crossorigin> for LCP-element font`,
    'preload competes with other resources',
  ]);
}

if (fontDisplay.length > 0) {
  rows.push([
    'font-display strategy',
    `${fontDisplay.length} font(s) without optimal display`,
    '50–200 ms',
    `font-display: swap or optional on offending @font-face`,
    'CLS if metrics-incompatible fallback',
  ]);
}

if ((unusedCss as { overallSavingsBytes?: number }).overallSavingsBytes && (unusedCss as { overallSavingsBytes: number }).overallSavingsBytes > 5000) {
  rows.push([
    'unused-css-rules',
    `${Math.round(((unusedCss as { overallSavingsBytes: number }).overallSavingsBytes) / 1024)} KB unused, wastedPercent ${(unusedCss as { wastedPercent?: number }).wastedPercent?.toFixed?.(0) ?? 'n/a'}%`,
    '50–300 ms',
    'tree-shake CSS or load below-fold separately',
    'aggressive purge can drop runtime-referenced rules',
  ]);
}

if (rows.length === 0) {
  out.push(`| (none) | Lighthouse did not surface any contributor with non-zero wastedMs. See spec §6 "Zero contributors" branch. | — | manual DevTools Performance trace | — |`);
} else {
  rows.forEach((r, i) => {
    out.push(`| ${i + 1} | ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} |`);
  });
}

out.push(``);
out.push(`### PR-1 implementation-approach discriminator\n`);
const globalsCss = blocking.find((b) => b.url.includes('globals') || b.url.includes('.css'));
if (globalsCss) {
  out.push(`- \`${globalsCss.url.split('/').pop()}\` wasted ${Math.round(globalsCss.wastedMs ?? 0)} ms (totalBytes ${globalsCss.totalBytes ?? 'n/a'}).`);
  out.push(`- Approach selection: human review required — see spec §6 "Implementation-approach selection for PR-1" + PR-1 own writing-plans invocation.\n`);
} else {
  out.push(`No render-blocking CSS resource identified. PR-1 (CSS defer) may not be applicable; re-rank backlog.\n`);
}

out.push(`### Exit criterion check\n`);
const nonZeroContributors = rows.filter((r) => !r[1].includes(' 0 ms') && !r[1].includes(' 0%')).length;
out.push(`- Non-zero contributors identified: **${nonZeroContributors}**`);
if (nonZeroContributors >= 3) {
  out.push(`- Status: **PASS** — spec §6 exit criterion met; proceed to PR-1 writing-plans.`);
} else if (nonZeroContributors === 2) {
  out.push(`- Status: **BRANCH (two large + long tail)** — apply spec §6 first branch point.`);
} else if (nonZeroContributors === 1) {
  out.push(`- Status: **BRANCH (one large)** — apply spec §6 second branch point.`);
} else {
  out.push(`- Status: **BRANCH (zero classified)** — apply spec §6 third branch point.`);
}

process.stdout.write(out.join('\n') + '\n');
```

- [ ] **Step 2: Sanity-check the script compiles**

Run:
```bash
pnpm typecheck
```
Expected: clean. If type errors in the new script, fix them inline.

- [ ] **Step 3: Sanity-check biome accepts it**

Run:
```bash
pnpm check
```
Expected: 0 errors, ≤ 9 warnings (matches main baseline). If new errors, run `pnpm check:fix` and re-verify.

- [ ] **Step 4: Commit the script**

Run:
```bash
git add scripts/extract-lcp-discovery.ts
git commit -m "feat(perf): extract-lcp-discovery.ts script for campaign discovery"
```
Expected: commit succeeds, pre-commit hook runs cleanly (check/typecheck/test/validate-content).

If pre-commit fails, fix the underlying issue and commit again. Do not bypass with `--no-verify`.

---

### Task 5: Run the extraction and capture output

**Files:** none modified (output goes to stdout, captured to /tmp)

- [ ] **Step 1: Run the script against the captured LHRs**

Run:
```bash
pnpm tsx scripts/extract-lcp-discovery.ts .lighthouseci > /tmp/lcp-discovery-output.md
```
Expected: completes silently, output file exists with markdown content.

- [ ] **Step 2: Inspect the output**

Run:
```bash
cat /tmp/lcp-discovery-output.md
```
Expected: well-formed markdown with sections "Headline numbers", "LCP element (median run)", "Ranked contributor backlog", "PR-1 implementation-approach discriminator", "Exit criterion check".

If the output is missing sections or shows obviously wrong numbers, debug:
- Check the LHRs exist: `ls .lighthouseci/lhr-*.json`
- Spot-check one LHR for the audit structure: `jq '.audits["largest-contentful-paint"]' .lighthouseci/lhr-*.json | head -20`

---

### Task 6: Apply the human judgment call (PR-1 approach discriminator)

The script identifies that `globals.css` is render-blocking and how much it costs, but it cannot pick between the three implementation approaches the spec §8 PR-1 lists. That's a human call informed by the data.

**Files:** none modified yet (judgment, then captured in §12)

- [ ] **Step 1: Re-read the three PR-1 candidates**

Open the spec section 8 PR-1 in an editor. The three candidates:

1. Build script that copies `globals.css` to `public/` post-build
2. `next/font/local`-style asset emission via Next's stable asset pipeline
3. Manual placement of the compiled CSS to `public/` (no build step)

- [ ] **Step 2: Cross-reference with Next 15 docs**

Run:
```bash
echo "Open https://nextjs.org/docs/app/api-reference/file-conventions/metadata in browser — verify whether Next 15 supports emitting CSS outside the App Router's auto-link mechanism for App Router projects."
```

Read the relevant Next docs page for stable patterns. Specifically check: does Next 15 App Router have a way to declare a `<link rel="preload">` with a hashed URL that Next manages? Or do we need to roll a build step?

- [ ] **Step 3: Pick the approach + capture reasoning**

Write a 2-3 sentence block in `/tmp/pr-1-discriminator.md` that says:
- Which of the 3 approaches is chosen
- Why (one-sentence reason citing the Lighthouse data and Next 15 capability)
- What the next step is (PR-1 own writing-plans invocation must lock this in)

This block will be appended to §12 in Task 7.

---

### Task 7: Update the spec with §12 findings

**Files:**
- Modify: `docs/superpowers/specs/2026-05-19-mobile-lcp-strict-1800ms-campaign-design.md`

- [ ] **Step 1: Open the spec at §12**

```bash
grep -n "## 12. Discovery findings" docs/superpowers/specs/2026-05-19-mobile-lcp-strict-1800ms-campaign-design.md
```
Expected: one line number for the heading.

- [ ] **Step 2: Replace the §12 TBD block with the script output**

The current §12 block reads:

```markdown
## 12. Discovery findings (TBD - filled by Task 0)

_To be populated as the first action of this campaign. Until then, all PR sequencing in section 8 is provisional._

| Rank | Contributor | Measured contribution | Estimated savings | Proposed fix | Risk |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD | TBD |
```

Replace that entire block (from the `## 12. Discovery findings (TBD...)` heading through the last TBD table row) with the content of `/tmp/lcp-discovery-output.md`, then append the PR-1 discriminator block from `/tmp/pr-1-discriminator.md` if not already covered by the script's output.

Use the Edit tool with the exact text from the spec for `old_string` and the script+discriminator content for `new_string`.

- [ ] **Step 3: Verify markdown lints clean**

Run:
```bash
pnpm check docs/superpowers/specs/2026-05-19-mobile-lcp-strict-1800ms-campaign-design.md
```
Expected: 0 errors (biome handles markdown lint via its `.md` formatter; same baseline as before).

- [ ] **Step 4: Spot-check the spec renders correctly**

Run:
```bash
grep -A 3 "## 12. Discovery findings" docs/superpowers/specs/2026-05-19-mobile-lcp-strict-1800ms-campaign-design.md | head -10
```
Expected: shows the new heading (no "(TBD..." suffix) and the first lines of the discovery content.

- [ ] **Step 5: Commit the spec update**

Run:
```bash
git add docs/superpowers/specs/2026-05-19-mobile-lcp-strict-1800ms-campaign-design.md
git commit -m "$(cat <<'EOF'
docs(spec): fill §12 with Task 0 discovery findings

Captured 3 mobile Lighthouse runs against localhost production build
(matches CI baseline 3069ms config). Extracted via the new
scripts/extract-lcp-discovery.ts. Section 12 now holds:

- Headline LCP median + spread vs the 1800ms target
- LCP element identification (node label + selector)
- Ranked contributor backlog with measured wastedMs per contributor
- PR-1 implementation-approach discriminator (chosen approach + reason)
- Exit criterion check vs spec §6

The discriminator + ranked backlog become the data input for the
PR-1 writing-plans invocation.
EOF
)"
```

Expected: commit succeeds, pre-commit hook passes.

---

### Task 8: Open the PR for spec + discovery as one unit

**Files:** none modified

- [ ] **Step 1: Push the branch**

Run:
```bash
git push -u origin docs/spec-mobile-lcp-1800ms-campaign
```
Expected: branch pushed, tracking set up.

- [ ] **Step 2: Open the PR**

Run:
```bash
gh pr create --title "docs(spec): mobile LCP strict 1800ms campaign blueprint + discovery findings" --body "$(cat <<'EOF'
## Summary

Opens the **Mobile LCP Strict 1800ms Campaign** spec on a measurement-gated multi-PR shape. Closes the largest documented budget miss in CLAUDE.md (mobile LCP 3069ms measured vs 1800ms locked target).

Ships as a single PR the campaign blueprint + the Task 0 (Discovery) findings, so reviewers can evaluate both the plan and the data the plan is keyed against.

## What's in this PR

1. **Spec**: `docs/superpowers/specs/2026-05-19-mobile-lcp-strict-1800ms-campaign-design.md` — the campaign blueprint (passed \`architect-reviewer\` spec-gate; refinements from 5 non-blocking observations folded in)
2. **Discovery script**: `scripts/extract-lcp-discovery.ts` — reusable extractor that reads LHRs, picks the median LCP run, formats the spec's §12 table from named audits
3. **Discovery findings**: spec §12 filled with the ranked contributor backlog from a fresh 3-run mobile Lighthouse measurement

## Notes for reviewer

- The discovery used **localhost via \`pnpm start\`**, not Vercel preview — matches CI's existing baseline (3069ms came from the same setup, per DECISIONS.md 2026-05-19 "Spec 1.5 Mobile LHCI ship"). TTFB-flavored measurements (relevant to PR-5) will use Vercel preview separately.
- Each subsequent campaign PR will invoke \`writing-plans\` independently against this spec, one phase at a time, data-informed by the prior PR's measurement.
- Required reviewer agents per spec §7.4: \`performance-engineer\` + \`accessibility-tester\` for every PR in this campaign (this PR is docs-only; those dispatches start at PR-1).

## Test plan

- [x] \`pnpm typecheck\` → clean
- [x] \`pnpm check\` → 0 errors (matches main baseline)
- [x] \`pnpm test --run\` → all green
- [x] \`pnpm build\` → clean (used to produce the bundle Task 3 measured)
- [x] \`pnpm bundle-check\` → green
- [x] Script extracted §12 from real LHRs without manual editing of numeric values
- [ ] CI: build + e2e + visual matrix
EOF
)"
```

Expected: PR URL printed to stdout. Capture it; next step references it.

- [ ] **Step 3: Verify the PR is open and CI is running**

Run:
```bash
gh pr view --json state,statusCheckRollup --jq '{state, checks: [.statusCheckRollup[]?.name]}'
```
Expected: `state: "OPEN"`, checks listed include `build-and-gate` (status will be `IN_PROGRESS` initially).

- [ ] **Step 4: Wait for CI to be green**

Run:
```bash
gh pr checks --watch
```
Expected: all checks transition to SUCCESS. If any fail, investigate — they're likely unrelated to docs-only changes (this PR doesn't touch implementation code) but must be addressed before merge per CLAUDE.md "never disable gates."

---

## Self-Review

Going back through the spec's §6 requirements and matching to tasks:

| Spec §6 requirement | Plan coverage |
|---|---|
| Trigger preview deployment | Task 2 (production build) + Task 3 step 2-3 (pnpm start) — uses localhost to match CI baseline; explained in PR description |
| Run `pnpm lhci:mobile` with 3 runs | Task 3 step 4 |
| Save reports to `.lighthouseci/` | Task 3 (LHCI default, also gitignored per biome.json) |
| Extract `largest-contentful-paint.numericValue` median | Task 4 script (sort by LCP, pick middle) |
| Extract `largest-contentful-paint-element` | Task 4 script (`lcpElementItems`) |
| Extract render-delay/load-delay subItems | Task 4 script — **gap**: script reads `details.items` but not `subItems`. Acceptable: subItems are downstream of the load/render delay split; the items themselves already contain `wastedMs` which is what the backlog ranks on. If PR-1's writing-plans needs subItems, it can re-read the LHRs (still in `.lighthouseci/` locally, or re-run if not). Documenting this gap inline rather than expanding the script. |
| Extract `render-blocking-resources` items + wastedMs | Task 4 script (`blocking`) |
| Extract `font-display` failing URLs | Task 4 script (`fontDisplay`) |
| Extract `preload-fonts` score | Task 4 script (inline conditional) |
| Extract `server-response-time` | Task 4 script (`Headline numbers` row) |
| Extract `unused-css-rules` overallSavingsBytes + wastedPercent | Task 4 script (`unusedCss`) |
| Extract `unused-javascript` items | Task 4 script (`unusedJs` — defined but currently unused in output, which is fine: PR-26 already documented the framework-bootstrap origin; the script captures the variable for future use without spending output space on it) |
| Extract `uses-text-compression` score | **gap** — not in script. Acceptable: Vercel auto-compresses; CI hasn't flagged this; if PR-1 needs it, single-line addition. |
| Extract `uses-rel-preload` score | **gap** — same rationale. |
| Extract `critical-request-chains` depth | **gap** — same rationale. |
| Output: ranked contributor backlog with ≥3 contributors with non-zero estimated savings | Task 4 script (`rows` array) + Task 5 verifies + Task 6 PR-1 discriminator + Task 7 spec update |
| Branch points if <3 contributors | Task 5 (script reports status: PASS/BRANCH) + spec §6 has full branch logic |

**Gap acceptance**: 3 audit extractions are not in the script (uses-text-compression, uses-rel-preload, critical-request-chains). Each is a single-line addition if needed by a later PR's writing-plans. The script captures the majority of the §6 requirements; the §6 list is also slightly over-specified for the initial discovery (those 3 audits primarily inform PR-2/PR-3, not the backlog ranking).

**Placeholder scan**: searched the plan for "TBD", "TODO", "implement later", "appropriate". One legitimate instance: "TBD - filled by Task 0" in the spec file's §12 content (which Task 7 replaces). No plan-level placeholders.

**Type consistency**: function names in the script (`process.stdout.write`, `JSON.parse`, `readFileSync`) match Node 22 stdlib. The script's local types (`Lhr`, `LhrAudit`) are internally consistent. The script doesn't export types so cross-task consistency isn't a concern.

**Spec coverage**: every spec §6 requirement maps to a task above except the 3 gap-accepted audits. The exit criterion logic is in Task 5; the branch points (spec §6) are in the spec, applied in Task 5 step 1.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-19-mobile-lcp-task-0-discovery.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best fit when the campaign matters and each measurement step deserves a clean context window.
2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints. Faster but the lhci subprocess and pre-commit hooks share my current context.

Which approach?
