# CI/CD Group C — DX Optimization

**Date:** 2026-06-05
**Status:** Approved for implementation
**PR size:** Single PR, ~12 hours total effort (3 sub-changes)
**Branch:** `ci/dx-optimization`

---

## Problem

The developer pipeline imposes ~15-22 hours/week of foreground blocking time on a solo developer:

**Pre-push cost (dominant):** Every non-docs push triggers `gates:runtime` in `.husky/pre-push`:
full Next.js production build (3-5 min) + server start + serial LHCI desktop (~90s) + LHCI mobile
(~90s) + axe-core (~30s) + E2E functional (~60s). Total: 12-20 minutes per push. At 8 pushes/day,
this is 1.6-2.7 hours/day of terminal-watching.

**Review stamp cost (compounding):** `post-commit` clears `.review-passed` after every commit.
A branch with 8 commits and 4 push iterations requires 4 complete battery cycles (5-agent dispatch
+ triage + stamp). Each cycle: 10-15 min. Redundant cycles: 3-5 per PR.

**Gates-runtime serial bottleneck:** After the server starts, the 4 post-build gates (LHCI desktop,
LHCI mobile, axe-core, E2E functional) run sequentially via `execFileSync`. Zero data dependency
between them. The wall time is their sum (~4-5 min) instead of their max (~90s).

---

## Design

Three independent sub-changes, all in one PR (they are sequentially dependent: C3 requires C1 to
be safe — without the parallelized fast local gates, removing gates:runtime from pre-push leaves
developers without a viable fast local substitute).

### C1 — Parallelize gates-runtime.ts post-build gates

**File:** `scripts/gates-runtime.ts`

Replace the sequential `advisory()` / `gate()` / `run()` calls after server start with a
parallel runner using `child_process.spawn` wrapped in Promises + `Promise.allSettled`.

**Critical constraint:** `execFileSync` is synchronous and blocks the Node.js event loop. Wrapping
`execFileSync` calls in async functions and `Promise.all` produces ZERO parallelism — the first
call blocks until completion before any other code runs. Actual concurrency requires async
`child_process.spawn` (or promisified `execFile`), which spawns a subprocess without blocking.

**Architecture:**
- Build and server-start phases remain sequential (unchanged from current implementation).
- After `wait-on` confirms the server is up, all 4 gates are spawned concurrently.
- Results are collected via `Promise.allSettled` (never throws — collects all results including failures).
- After all settle, failures are reported and process exits with code 1 if any blocking gate failed.
- Server teardown runs in the `finally` block after all gates complete.

**New async gate runner:**

```typescript
interface GateResult {
  label: string;
  advisory: boolean;
  passed: boolean;
  durationMs: number;
  output: string; // buffered stdout+stderr, printed after all gates settle
}

function spawnGate(
  label: string,
  advisory: boolean,
  file: string,
  args: string[],
): Promise<GateResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    let output = '';
    const child = spawn(file, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    child.stdout.on('data', (d: Buffer) => { output += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { output += d.toString(); });
    child.on('error', (err) => {
      resolve({ label, advisory, passed: false, durationMs: Date.now() - start, output: err.message });
    });
    child.on('close', (code) => {
      resolve({ label, advisory, passed: code === 0, durationMs: Date.now() - start, output });
    });
  });
}
```

**Main parallel block** (replaces gates 3-6 in the current sequential chain):

```typescript
const results = await Promise.allSettled([
  spawnGate('Lighthouse CI — desktop', true, 'pnpm', [
    'exec', 'lhci', 'autorun',
    `--collect.url=http://localhost:${PORT}`,
    '--upload.target=filesystem', '--upload.outputDir=.lhci-local/desktop',
  ]),
  spawnGate('Lighthouse CI — mobile', true, 'pnpm', [
    'exec', 'lhci', 'autorun', '--config=lighthouserc.mobile.json',
    `--collect.url=http://localhost:${PORT}`,
    '--upload.target=filesystem', '--upload.outputDir=.lhci-local/mobile',
  ]),
  spawnGate('axe-core a11y scan', false, 'pnpm', [
    'playwright', 'test', 'tests/a11y', '--project=chromium',
  ]),
  spawnGate('E2E functional — chromium', false, 'pnpm', [
    'playwright', 'test', '--project=chromium',
    'tests/e2e/cross-cutting.spec.ts', 'tests/e2e/observability-smoke.spec.ts',
  ]),
]);

// Print all buffered output, then summary
for (const r of results) {
  if (r.status === 'fulfilled') {
    if (r.value.output.trim()) process.stdout.write(r.value.output);
  }
}

log('\n[gates:runtime] Results:');
for (const r of results) {
  if (r.status !== 'fulfilled') continue;
  const { label, advisory, passed, durationMs } = r.value;
  const icon = passed ? C.green + '  ✓' : C.red + '  ✗';
  const tag = advisory ? '(advisory)' : '(blocking)';
  log(`${icon}${C.reset} ${label.padEnd(35)} ${tag.padEnd(12)} ${(durationMs / 1000).toFixed(1)}s`);
  if (!passed && !advisory) exitCode = 1;
}
```

**Stdout management:** Each gate buffers its output (`stdio: ['ignore', 'pipe', 'pipe']`) and
prints it after all gates settle. Output is deferred but complete — no interleaving.

**Wall-clock timeout:** Add a 300-second maximum across all 4 gates:

```typescript
const timeoutPromise = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error('gates:runtime exceeded 300s wall-clock limit')), 300_000)
);
const results = await Promise.race([Promise.allSettled([...gates]), timeoutPromise]);
```

**Expected outcome:** Post-build gate phase: ~5-6 min serial → ~90s parallel (max of the 4).
Total `gates:runtime` time: 12-20 min → 8-12 min (build + server start still sequential).

### C2 — Remove post-commit stamp clearance

**Files:** `.husky/post-commit` only

**Problem in detail:** The stamp boundary is `headCommitIso` — the timestamp of the HEAD commit.
Battery agents dispatched after the HEAD commit timestamp satisfy the battery. The stamp is written
to `.review-passed` with the HEAD SHA. `post-commit` deletes `.review-passed` on every commit,
so the stamp is always gone after a commit — requiring a fresh battery before every push even
if the battery was already run against a prior commit in the same push cycle.

**Correction from initial design:** The original spec proposed a `post-push` hook to clear the
stamp after each push. `post-push` is not a real git client-side hook — git defines `pre-push`
and server-side hooks but no `post-push`. Any file at `.husky/post-push` is silently ignored.
The correct clearance mechanism is simpler: rely on the existing SHA-mismatch check in `pre-push`.

**How SHA-mismatch handles invalidation naturally:**
1. Developer makes commits A, B, C on branch.
2. Runs battery at HEAD=C → stamps `.review-passed` with SHA=C.
3. `pre-push`: `STAMPED_SHA=C == HEAD_SHA=C` → passes.
4. Push succeeds.
5. Developer makes commit D for a fix.
6. `pre-push`: `STAMPED_SHA=C != HEAD_SHA=D` → blocked → must re-run battery at HEAD=D.

The SHA-mismatch in `pre-push` (already implemented at `.husky/pre-push:25`) is the sole
clearance mechanism. No `post-push` hook needed.

**Implementation:**

`.husky/post-commit` change: remove the `rm -f .review-passed` line. The stamp persists
across commits until the next `pre-push` detects a HEAD SHA mismatch.

**No changes to `scripts/review-stamp.ts`.** The `headCommitIso` boundary is correct and
preserved. The existing invariant holds: "battery was dispatched AFTER HEAD commit's timestamp"
ensures the battery ran against the CURRENT code state before each push.

**No new hook files.** No `getPushRangeBaseIso`. No `decideStamp` signature change.

**Expected outcome:** A branch with 8 commits requires 1 battery cycle (after the last commit)
instead of 8 cycles. Battery overhead per PR: once per push iteration, not once per commit.

**Result:** Tests for `review-stamp.ts` do NOT require updates (boundary semantics unchanged).

### C3 — Move gates:runtime to opt-in

**Files:** `.husky/pre-push`, `CLAUDE.md`

**Remove from pre-push:** Delete the `gates:runtime` invocation block from `.husky/pre-push`
(currently lines 66-101). The pre-push hook becomes:
1. Branch name lint
2. Review stamp check
3. API-edit security marker check
4. `pnpm verify` (typecheck + content + naming + dep-pinning + harness-size + unit tests)

The docs-only path-filter logic (lines 70-101) is also removed — it only existed to gate
`gates:runtime`. With `gates:runtime` gone from pre-push, all non-docs pushes run `pnpm verify`
only (which is already the same cost as the docs path).

`SKIP_RUNTIME_GATES` env var and its log block can be removed (they only guarded `gates:runtime`).

**Add to CLAUDE.md working agreement:** Update the section that says "Runtime gates before any
push touching non-docs files" to:

```
- **Runtime gates before opening a PR — manual, not enforced by pre-push.**
  Run `pnpm gates:runtime` before `pnpm ready-for-pr` for non-docs changes.
  CI remains the authoritative gate. The pre-push hook no longer runs `gates:runtime`
  automatically — the 12-20 min cost per push was imposing 10+ hrs/week of foreground
  blocking time on a solo developer who watches CI regardless.
```

**CLAUDE.md working agreement update:** The "Verification before any completion claim" section
must be updated to remove the implied `pnpm gates:runtime` from pre-push and re-state it as
a pre-PR manual step.

**Expected outcome:** Pre-push drops from 12-20 min to 2-3 min for all non-docs pushes.
Developer recovers 10+ hours/week of foreground blocking time. CI remains the authoritative gate.

**Risk mitigation:** `pnpm gates:runtime` remains available as a manual command. The `ready-for-pr`
script documents it as a required pre-PR step. CLAUDE.md makes the change explicit. The risk is
that a performance regression reaches CI before local detection (MTTD increases from 15 min to
45-55 min). For a solo developer who watches CI, this is a ~30-40 min delay, not a missed bug.

---

## Implementation Order

C1 must be implemented before C3 is shipped. Rationale: if `gates:runtime` is moved to opt-in
before it's fast (C1), the tool developers are told to "run before opening PRs" is still slow.
C1 makes the opt-in tool fast enough to be used willingly.

C2 is independent of C1 and C3. It is the simplest change (one line removed from post-commit).

Recommended sequence within the PR:
1. Implement C2 (remove `rm -f .review-passed` from `.husky/post-commit`)
2. Implement C1 (async `spawn`-based parallel runner in `gates-runtime.ts`)
3. Implement C3 (remove `gates:runtime` block from `pre-push`, update `CLAUDE.md` + consumer scan)

---

## Files Changed

| File | Change type | Change |
|---|---|---|
| `scripts/gates-runtime.ts` | Edit | Async spawn-based parallel runner (C1) |
| `.husky/post-commit` | Edit | Remove `rm -f .review-passed` (C2) |
| `.husky/pre-push` | Edit | Remove `gates:runtime` block, remove docs-filter, remove SKIP_RUNTIME_GATES (C3) |
| `CLAUDE.md` | Edit | Update working agreement: gates:runtime → pre-PR manual step + consumer scan (C3) |

---

## Tests

`review-stamp.ts` has tests at `__tests__/scripts/review-stamp.test.ts`. C2 makes NO changes
to `review-stamp.ts` or its boundary semantics — the `headCommitIso` param and `decideStamp`
function are unchanged. No test updates required for C2.

`gates-runtime.ts` changes are integration-level. No unit tests exist for it currently.
Manual verification: run `pnpm gates:runtime --skip-build` (requires existing `.next/`).
Confirm all 4 gates spawn concurrently by observing their buffered outputs appearing in a
non-sequential order, and confirm total elapsed time < 3 min (wall-clock max of all 4 gates).

**C3 consumer scan requirement:** Before editing CLAUDE.md and `pre-push`, grep for all
references to `gates:runtime` across the repo and `pre-push` enforcement claims across
all markdown files. Update or remove every claim so doc assertions match the new live behavior
(STANDARDS.md Chapter 10 "doc claims must match live code" is an enforced PR-review property).

```bash
grep -rn 'gates:runtime\|SKIP_RUNTIME_GATES' . --include='*.md' --include='*.ts' --include='*.mjs' --include='*.sh' | grep -v node_modules | grep -v .next
```

---

## Verification

After merging:

1. **Pre-push timing:** make a trivial change, commit, push. Confirm pre-push completes in
   < 3 minutes (no `gates:runtime` output).
2. **Stamp push-range:** commit 3 times without pushing. Run the battery and stamp once.
   Push all 3 commits. Confirm push succeeds. Confirm `.review-passed` is absent after push.
   Confirm next push requires a fresh battery.
3. **Gates-runtime parallel:** run `pnpm gates:runtime --skip-build` (requires existing `.next/`).
   Confirm LHCI desktop, LHCI mobile, axe-core, and E2E functional output appears roughly
   simultaneously (interleaved, not sequential). Confirm total time < 3 min (vs prior ~5-6 min).
4. **Review stamp tests:** `pnpm test --run scripts/review-stamp` passes with all updated cases.

---

## Risk

- **C2 fail-open concern:** the `epoch-0` base for disconnected repos is theoretically too
  permissive. In practice, a disconnected repo cannot push. The meaningful fail-closed case
  (transcript not found) is preserved. Accept this risk.
- **C3 MTTD increase:** performance regressions reach CI before local detection. Developer
  watches CI after push regardless. The 30-40 min MTTD increase is inconvenient, not dangerous.
  Pre-PR `pnpm gates:runtime` restores local MTTD to 8-12 min (with C1 parallelization).
- **Parallel stdout interleaving:** in C1, deferred output means long-running tests don't show
  progress until they complete. If a test hangs, `gates:runtime` appears frozen. The global
  30-second server wait-on timeout is a lower bound; individual gate timeouts are process-level.
  Add a maximum wall-clock timeout of 300s to the parallel runner to prevent indefinite hang.
