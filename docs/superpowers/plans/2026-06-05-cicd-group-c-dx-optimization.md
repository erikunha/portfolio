# Implementation Plan: CI/CD Group C — DX Optimization

**Spec:** `docs/superpowers/specs/2026-06-05-cicd-group-c-dx-optimization-design.md`
**Branch:** `ci/dx-optimization`
**Goal:** Recover ~10+ hours/week of developer foreground blocking time by (1) parallelizing gates-runtime's post-build phase from ~5-6 min serial to ~90s parallel, (2) removing the redundant post-commit stamp clearance so a single battery covers a full push cycle, and (3) moving `gates:runtime` from the pre-push hook to a manual pre-PR step.
**Estimated effort:** ~12 hours (C1 is the complex change)
**PR size:** Single PR, 4 files changed

---

## Architecture

**Implementation order matters:**
1. **C2 first** (simplest, independent, 1 line removed from `.husky/post-commit`)
2. **C1 second** (async spawn-based parallel runner in `scripts/gates-runtime.ts`)
3. **C3 third** (remove `gates:runtime` from pre-push; C3 ships a fast `gates:runtime` as the opt-in alternative, so C1 must be done first)

**Why C1 before C3:** If `gates:runtime` is moved to opt-in (C3) before it's fast (C1), the developer is told "run this before PRs" but the tool is still slow. C1 makes the opt-in tool worth using.

**File map:**
| Change | File |
|---|---|
| C2 | `.husky/post-commit` |
| C1 | `scripts/gates-runtime.ts` |
| C3 | `.husky/pre-push`, `CLAUDE.md` |

**What C2 does NOT change:** `scripts/review-stamp.ts` and its `headCommitIso` boundary are unchanged. Tests at `__tests__/scripts/review-stamp.test.ts` do not need updates. The SHA-mismatch check in `pre-push` (line 25) already handles natural stamp invalidation when new commits are made.

**How natural invalidation works after C2:**
1. Make commits A, B, C on branch
2. Run battery at HEAD=C → stamp `.review-passed` with SHA=C
3. `pre-push`: `STAMPED_SHA=C == HEAD_SHA=C` → passes
4. Make commit D for a fix
5. `pre-push`: `STAMPED_SHA=C != HEAD_SHA=D` → BLOCKED → must re-run battery at HEAD=D

No `post-push` hook needed. (`post-push` is not a real git client-side hook — a file at `.husky/post-push` would be silently ignored.)

---

## Pre-flight

- [ ] **Create branch:**
  ```bash
  git checkout main && git pull origin main
  git checkout -b ci/dx-optimization
  ```

- [ ] **Read `scripts/gates-runtime.ts`** in full to understand the current structure before modifying it. Key points:
  - Gates 1-2 (build + server start) must remain sequential
  - Gates 3-6 (LHCI desktop, LHCI mobile, axe-core, E2E functional) are the parallel targets
  - `spawn` is already imported at line 33: `import { type ChildProcess, execFileSync, spawn } from 'node:child_process'`
  - `advisory()` and `gate()` helpers use `execFileSync` — these will be replaced for gates 3-6 only

- [ ] **Verify existing tests pass before changes:**
  ```bash
  pnpm test --run __tests__/scripts/review-stamp.test.ts 2>&1 | tail -5
  # Expected: all pass
  ```

---

## C2 — Remove post-commit stamp clearance (1 line)

- [ ] **Edit `.husky/post-commit`** — remove the `rm -f .review-passed` line. The file currently reads:

  ```sh
  # Clear review stamp on every new commit — the new HEAD must be reviewed
  # before pushing. Run review agents, then: pnpm review:stamp
  rm -f .review-passed
  ```

  After the change, remove only the `rm -f .review-passed` line. The comment block can be removed too (it describes the deleted behavior). The file becomes empty or contains only a shebang if one exists. If the file would be empty, it can remain as an empty file — husky runs it harmlessly.

  Final file content (replace the entire file):
  ```sh
  ```

  (Empty file — the hook exists but does nothing.)

- [ ] **Verify the stamp is NOT cleared after a `git commit`:**
  ```bash
  echo "test-sha" > .review-passed
  git add --dry-run .   # Don't actually stage anything
  git commit --allow-empty -m "test: verify post-commit no longer clears stamp"
  cat .review-passed
  # Expected: test-sha (file still present, unchanged)
  git reset HEAD~1   # Undo the test commit
  rm .review-passed  # Clean up
  ```

---

## C1 — Parallelize gates-runtime.ts post-build gates

This is the most significant change. The `advisory()` and `gate()` calls for gates 3-6 use `execFileSync`, which blocks the Node.js event loop. Wrapping them in `async`/`Promise.all` produces zero parallelism. True concurrency requires `child_process.spawn` with async event handlers.

### C1.1 — Add GateResult interface and spawnGate function

- [ ] **Edit `scripts/gates-runtime.ts`** — add the `GateResult` interface and `spawnGate` function after the existing `advisory` function (before Gate 1 comment):

  ```typescript
  interface GateResult {
    label: string;
    advisory: boolean;
    passed: boolean;
    durationMs: number;
    output: string;
  }

  function spawnGate(
    label: string,
    isAdvisory: boolean,
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
        resolve({
          label,
          advisory: isAdvisory,
          passed: false,
          durationMs: Date.now() - start,
          output: err.message,
        });
      });
      child.on('close', (code) => {
        resolve({
          label,
          advisory: isAdvisory,
          passed: code === 0,
          durationMs: Date.now() - start,
          output,
        });
      });
    });
  }
  ```

### C1.2 — Replace gates 3-6 with parallel runner

- [ ] **Replace the 4 sequential advisory/gate calls** (gates 3-6: Lighthouse desktop, Lighthouse mobile, axe-core, E2E functional) with this parallel block:

  ```typescript
  // ── Gates 3-6: Post-build gates (parallel) ────────────────────────────────────
  // These 4 gates have no data dependency on each other. Running them sequentially
  // via execFileSync wastes ~4-5 min of wall-clock time. spawn-based parallel runner
  // reduces wall-clock to the max of the 4 (~90s).

  step('Running post-build gates in parallel');

  const gatePromises = [
    spawnGate('Lighthouse CI — desktop', true, 'pnpm', [
      'exec', 'lhci', 'autorun',
      `--collect.url=http://localhost:${PORT}`,
      '--upload.target=filesystem',
      '--upload.outputDir=.lhci-local/desktop',
    ]),
    spawnGate('Lighthouse CI — mobile', true, 'pnpm', [
      'exec', 'lhci', 'autorun',
      '--config=lighthouserc.mobile.json',
      `--collect.url=http://localhost:${PORT}`,
      '--upload.target=filesystem',
      '--upload.outputDir=.lhci-local/mobile',
    ]),
    spawnGate('axe-core a11y scan', false, 'pnpm', [
      'playwright', 'test', 'tests/a11y', '--project=chromium',
    ]),
    spawnGate('E2E functional — chromium', false, 'pnpm', [
      'playwright', 'test', '--project=chromium',
      'tests/e2e/cross-cutting.spec.ts',
      'tests/e2e/observability-smoke.spec.ts',
    ]),
  ];

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('gates:runtime exceeded 300s wall-clock limit')),
      300_000,
    ),
  );

  let results: PromiseSettledResult<GateResult>[];
  try {
    results = await Promise.race([
      Promise.allSettled(gatePromises),
      timeoutPromise,
    ]) as PromiseSettledResult<GateResult>[];
  } catch (err) {
    process.stderr.write(
      `${C.red}${C.bold}[gates:runtime] ${err instanceof Error ? err.message : String(err)}${C.reset}\n`,
    );
    cleanup();
    process.exit(1);
  }

  // Print all buffered output first (deferred to avoid interleaving)
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.output.trim()) {
      process.stdout.write(r.value.output);
    }
  }

  // Print result summary
  log(`\n${C.bold}[gates:runtime] Post-build gate results:${C.reset}`);
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { label, advisory: isAdvisory, passed, durationMs } = r.value;
    const icon = passed ? `${C.green}  ✓` : `${C.red}  ✗`;
    const tag = isAdvisory ? '(advisory)' : '(blocking)';
    log(
      `${icon}${C.reset} ${label.padEnd(35)} ${tag.padEnd(12)} ${(durationMs / 1000).toFixed(1)}s`,
    );
    if (!passed) {
      if (isAdvisory) {
        advisoryFailed = true;
      } else {
        exitCode = 1;
      }
    }
  }
  ```

### C1.3 — Wrap top-level execution in async IIFE

- [ ] The file currently uses top-level `await` via `tsx`. Confirm this is valid (tsx supports it). If the parallel block above uses `await`, it must be in an async context. The existing file is already a module-level script run by tsx, which handles top-level await. No IIFE needed if tsx already supports it in the current setup.

  **Verify tsx supports top-level await in this project:**
  ```bash
  node -e "const {execFileSync} = require('child_process'); execFileSync('pnpm', ['exec', 'tsx', '--version'], {stdio:'inherit'})"
  ```
  tsx 4.x supports top-level await. If the version is older, wrap the parallel block in `(async () => { ... })()`.

### C1.4 — Remove now-unused advisory() and gate() helpers

After replacing gates 3-6, the `advisory()` and `gate()` helper functions are no longer called. Remove them to avoid dead code. Keep `run()` — it is still used for gates 1-2 (build and wait-on).

- [ ] **Remove `gate()` and `advisory()` functions** from `scripts/gates-runtime.ts`.

- [ ] **Update the file-top comment** to reflect that gates 3-6 now run in parallel:
  ```typescript
  // Gates (in order):
  //   1. Build          — pnpm build (skip with --skip-build if .next/ is fresh)
  //   2. Server start   — pnpm start on :3000 with DEPLOY_SALT
  //   3-6. Parallel     — LHCI desktop (advisory), LHCI mobile (advisory),
  //                        axe-core (blocking), E2E functional (blocking)
  //
  // Gates 3-6 run concurrently via child_process.spawn (not execFileSync which
  // blocks the event loop). Wall-clock: max of the 4 (~90s) instead of sum (~5-6 min).
  ```

### C1.5 — Manual verification

- [ ] **Build the project and run gates:runtime in parallel mode:**
  ```bash
  pnpm build 2>&1 | tail -5
  pnpm gates:runtime --skip-build 2>&1 | tail -30
  ```
  Confirm:
  - All 4 gate outputs appear (possibly interleaved — expected with parallel execution)
  - Gate results table appears at the end with `✓` or `✗` per gate and duration in seconds
  - Total elapsed time < 3 min (vs prior ~5-6 min serial)
  - LHCI gates are marked `(advisory)`, axe-core and E2E are marked `(blocking)`

- [ ] **Verify TypeScript compiles without errors:**
  ```bash
  pnpm typecheck 2>&1 | tail -10
  # Expected: no errors
  ```

---

## C3 — Move gates:runtime to opt-in

**Prerequisite:** C1 must be committed before C3 is committed (the opt-in tool must be fast).

### C3.1 — Consumer scan (required before editing any file)

- [ ] **Grep for all references to `gates:runtime` and `SKIP_RUNTIME_GATES` across the repo:**
  ```bash
  grep -rn 'gates:runtime\|SKIP_RUNTIME_GATES' . \
    --include='*.md' --include='*.ts' --include='*.mjs' --include='*.sh' \
    | grep -v node_modules | grep -v .next
  ```
  Record every file and line number. Each reference must be updated or removed in this PR. STANDARDS.md Chapter 10 ("doc claims must match live code") is a PR-review enforced property.

  Expected files to update: `.husky/pre-push`, `CLAUDE.md`. Check for references in `STANDARDS.md`, `ARCHITECTURE.md`, `DECISIONS.md`, and any `.md` in `.claude/`.

### C3.2 — Edit .husky/pre-push

- [ ] **Read `.husky/pre-push`** to identify the exact lines to remove. The current file has:
  - Lines 1-5: branch name guard (KEEP)
  - Lines 7-33: review stamp gate (KEEP)
  - Lines 35-54: API-edit security backstop (KEEP)
  - Lines 60-64: `pnpm verify` (KEEP)
  - Lines 66-101: `gates:runtime` block (REMOVE)
    - This includes: `RANGE_BASE=...`, `CHANGED=...`, `NON_DOCS=...`, `SKIP_RUNTIME_GATES` block, and `pnpm gates:runtime`

- [ ] **Edit `.husky/pre-push`** — remove the entire gates:runtime block (lines 66-101 approximately). The file after removal:
  1. Branch name guard
  2. Review stamp gate
  3. API-edit security backstop
  4. `pnpm verify`
  5. (End of file — no `gates:runtime` invocation)

  The removed block includes:
  - `RANGE_BASE=...` variable (docs-only path detection)
  - `CHANGED=git diff ...` computation
  - `NON_DOCS=grep ...` filtering
  - The `SKIP_RUNTIME_GATES` check + log block
  - The docs-only skip path
  - The `pnpm gates:runtime` invocation

- [ ] **Verify the pre-push hook structure is correct:**
  ```bash
  cat .husky/pre-push
  # Should show: branch guard → stamp gate → API marker check → pnpm verify → (end)
  # Should NOT contain: gates:runtime, SKIP_RUNTIME_GATES, RANGE_BASE, NON_DOCS
  ```

### C3.3 — Update CLAUDE.md working agreement

- [ ] **Find the section in `CLAUDE.md`** that says "Runtime gates before any push touching non-docs files — enforced by `.husky/pre-push`." This is under the Working agreement section.

- [ ] **Replace that section** with:

  ```markdown
  - **Runtime gates before opening a PR — manual, not enforced by pre-push.**
    Run `pnpm gates:runtime` before `pnpm ready-for-pr` for non-docs changes.
    CI remains the authoritative gate. The pre-push hook no longer runs `gates:runtime`
    automatically — the 12-20 min cost per push was imposing 10+ hrs/week of foreground
    blocking time on a solo developer who watches CI regardless.
  ```

- [ ] **Update the "Verification before any completion claim" section in `CLAUDE.md`** — remove any implication that `pnpm gates:runtime` runs automatically in pre-push. The section should reference it as a manual pre-PR step, not an automatic pre-push gate.

- [ ] **Update every other `gates:runtime` or `SKIP_RUNTIME_GATES` reference found in the consumer scan** (C3.1). For each file:
  - Remove enforcement claims for pre-push (now honor-system)
  - Keep references to `pnpm gates:runtime` as a manual pre-PR command (it still exists and is still valuable)

### C3.4 — Record in DECISIONS.md

- [ ] **Add to `DECISIONS.md`:**
  ```
  2026-06-05 — gates:runtime moved from pre-push enforcement to pre-PR manual step (ci/dx-optimization). Previously enforced by .husky/pre-push. Removed to recover 10+ hrs/week of foreground blocking time for a solo developer. CI remains authoritative. MTTD for perf regressions increases from 15 min (local) to 45-55 min (CI). Reversibility: restore the removed lines to .husky/pre-push from git history.
  ```

---

## Final Verification

- [ ] **Review stamp tests still pass (C2 must not break them):**
  ```bash
  pnpm test --run __tests__/scripts/review-stamp.test.ts 2>&1 | tail -10
  # Expected: all pass (boundary semantics unchanged)
  ```

- [ ] **Pre-push timing:** make a trivial change, commit, run pre-push manually:
  ```bash
  bash .husky/pre-push 2>&1 | tail -10
  # Expected: completes in < 3 min with no gates:runtime output
  ```

- [ ] **gates:runtime parallel timing:**
  ```bash
  time pnpm gates:runtime --skip-build 2>&1 | tail -20
  # Expected: total real time < 3 min; individual gates show concurrent output
  ```

- [ ] **Stamp push-range behavior after C2:**
  - Commit 3 times without pushing
  - Run battery + stamp once (`pnpm review:stamp`)
  - Confirm `.review-passed` has the HEAD SHA
  - `git push` — should pass the stamp gate
  - Make one more commit
  - `git push` — should be BLOCKED by SHA mismatch (stamp has old SHA)

- [ ] **Full local gates:**
  ```bash
  pnpm ci:local 2>&1 | tail -10
  # Expected: all pass
  ```

---

## Commit Strategy

Two commits (natural separation at C2/C1 boundary):

- [ ] **Commit 1:** C2 only (1-line removal)
  ```bash
  git add .husky/post-commit
  git commit -m "ci(dx): remove post-commit stamp clearance — SHA-mismatch in pre-push handles invalidation"
  ```

- [ ] **Commit 2:** C1 + C3 together (C3 ships the fast opt-in; C1 makes it fast)
  ```bash
  git add scripts/gates-runtime.ts .husky/pre-push CLAUDE.md DECISIONS.md
  git commit -m "ci(dx): parallelize gates-runtime post-build phase; move gates:runtime to pre-PR opt-in"
  ```

---

## Failure Modes Checklist

| Risk | Mitigation |
|---|---|
| Parallel stdout interleaving causes confusing output | Output is buffered per gate and printed after all settle — no interleaving |
| A gate hangs indefinitely | 300s global wall-clock timeout on the parallel block |
| C2 fail-open for disconnected repos | A disconnected repo cannot push; the fail-open path is unreachable in practice |
| C3 MTTD increase for perf regressions | Developer watches CI after push; 30-40 min delay is inconvenient, not dangerous. Pre-PR `gates:runtime` restores local MTTD |
| Consumer scan misses a reference | grep command in C3.1 covers all .md, .ts, .mjs, .sh files; run before editing |
| `tsx` version doesn't support top-level await | Check version; wrap in async IIFE if needed (see C1.3) |
| `gate()` / `advisory()` removal breaks other callers | Both functions are only called in the removed sequential block; `run()` is kept |
