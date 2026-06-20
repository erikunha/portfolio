# Semgrep Fixture Self-Test Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove in CI, blocking, that the vendored Semgrep rules still fire on a known-vulnerable fixture and stay quiet on a known-clean one, so a broken vendored rule fails the job instead of shipping silently.

**Architecture:** A plain-`node` script `scripts/check-semgrep-fixture.mjs` copies the two fixtures to an OS temp dir (outside `.semgrepignore`'s `tests/fixtures/` exclusion), scans them with `--config .semgrep` only (vendored rules, no registry packs, deterministic/offline), and asserts each vendored rule fires on `vulnerable.ts` and zero findings on `clean.ts`. The assertion core is a pure exported function unit-tested under Vitest. A new blocking CI step runs the script; job-level `continue-on-error` moves to the report-only scan step so only the self-test gates.

**Tech Stack:** Node ESM (`.mjs`, no deps so the CI semgrep job needs no `pnpm install`), Vitest, Semgrep 1.97.0 (CI-installed), GitHub Actions YAML.

## Global Constraints

- **No em dash (`—`)** in any authored text, code, comment, or doc. Use a hyphen.
- **Stage specific files only** — `git add <path>`, never `git add .`/`-A`/`--all`.
- **`.mjs` stays plain-`node`-runnable** (no imports needing `node_modules`) so the CI `semgrep` job (which has no `pnpm install`) can run it with bare `node`.
- **`.mjs` imported by a `.ts` test requires a co-located `.d.mts`** under `allowJs: false` strict (mirror `scripts/lib/transcript.d.mts`), else `pnpm typecheck` fails TS7016.
- **Self-test scans `--config .semgrep` ONLY** — never the registry packs (`p/typescript`, `p/react`, `p/nextjs`); they are registry-latest and would make a blocking gate flaky.
- **Two vendored rule ids (exact):** `child-process-shell-injection` (`.semgrep/owasp-top-ten.yml`), `hardcoded-stripe-secret-key` (`.semgrep/secrets.yml`). Match `check_id` by suffix (Semgrep namespaces local-config ids by file path).
- **Exit codes:** `0` pass, `1` rule regression (assertion failed), `2` infrastructure failure (semgrep missing / scan crashed / unparseable JSON) — distinct so a broken runner is not read as a rule break.

---

### Task 1: Pure assertion function + unit test + type declaration

**Files:**
- Create: `scripts/check-semgrep-fixture.mjs` (pure function + `EXPECTED_RULES` only in this task)
- Create: `scripts/check-semgrep-fixture.d.mts`
- Test: `scripts/__tests__/check-semgrep-fixture.test.ts`

**Interfaces:**
- Produces: `EXPECTED_RULES: string[]` (`['child-process-shell-injection', 'hardcoded-stripe-secret-key']`); `assertExpectedFindings(results): { ok: true } | { ok: false, reason: string }` where `results` is an array of `{ path?: string, check_id?: string }`.

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/check-semgrep-fixture.test.ts`:

```ts
// scripts/__tests__/check-semgrep-fixture.test.ts
// Unit test for the Semgrep fixture self-test assertion core. The pure
// assertExpectedFindings() is tested against canned Semgrep `results` payloads
// (no Semgrep invocation here); the real scan runs in CI. Covers: both rules
// fire (pass), a single-rule break (fail), and clean.ts over-match (fail).
import { describe, expect, it } from 'vitest';
import { assertExpectedFindings, EXPECTED_RULES } from '../check-semgrep-fixture.mjs';

const f = (path: string, check_id: string) => ({ path, check_id });
const CMD = '.semgrep.owasp-top-ten.child-process-shell-injection';
const SECRET = '.semgrep.secrets.hardcoded-stripe-secret-key';

describe('EXPECTED_RULES', () => {
  it('names both vendored rule ids', () => {
    expect(EXPECTED_RULES).toEqual(['child-process-shell-injection', 'hardcoded-stripe-secret-key']);
  });
});

describe('assertExpectedFindings', () => {
  it('passes when both rules fire on vulnerable.ts and clean.ts is quiet', () => {
    const results = [f('/tmp/x/vulnerable.ts', CMD), f('/tmp/x/vulnerable.ts', SECRET)];
    expect(assertExpectedFindings(results)).toEqual({ ok: true });
  });

  it('fails naming the missing rule when the secret rule did not fire', () => {
    const results = [f('/tmp/x/vulnerable.ts', CMD)];
    const v = assertExpectedFindings(results);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('hardcoded-stripe-secret-key');
  });

  it('fails naming clean.ts when a rule over-matches the clean fixture', () => {
    const results = [f('/tmp/x/vulnerable.ts', CMD), f('/tmp/x/vulnerable.ts', SECRET), f('/tmp/x/clean.ts', CMD)];
    const v = assertExpectedFindings(results);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('clean.ts');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run scripts/__tests__/check-semgrep-fixture.test.ts`
Expected: FAIL — cannot resolve `../check-semgrep-fixture.mjs` (module does not exist yet).

- [ ] **Step 3: Create the script with the pure function only**

Create `scripts/check-semgrep-fixture.mjs`:

```js
#!/usr/bin/env node
// Semgrep fixture self-test. Proves the content-pinned vendored rules in
// .semgrep/ still fire. A clean tree makes the report-only scan find nothing
// whether the rules work or not, so this scans the fixtures (temp copy, since
// .semgrepignore excludes tests/fixtures/) with --config .semgrep ONLY and
// fails if a vendored rule stopped firing. See DECISIONS.md.
// Plain node (no deps) so the CI semgrep job runs it without pnpm install.

// The two vendored rule ids (from .semgrep/owasp-top-ten.yml and .semgrep/
// secrets.yml). Single update site: if a rule file renames its id, sync here
// and the self-test fails loudly until then (which is correct). Match by
// check_id SUFFIX: Semgrep namespaces a local-config rule id by file path.
export const EXPECTED_RULES = ['child-process-shell-injection', 'hardcoded-stripe-secret-key'];

// Pure. Given Semgrep `results[]`, assert each EXPECTED_RULES id fires on
// vulnerable.ts and clean.ts has zero findings. Returns a tagged verdict.
export function assertExpectedFindings(results) {
  const byFile = new Map(); // fixture basename -> check_id[]
  for (const r of results) {
    const base = String(r.path ?? '').split('/').pop() ?? '';
    if (!byFile.has(base)) byFile.set(base, []);
    byFile.get(base).push(String(r.check_id ?? ''));
  }
  const vulnIds = byFile.get('vulnerable.ts') ?? [];
  for (const rule of EXPECTED_RULES) {
    if (!vulnIds.some((id) => id.endsWith(rule))) {
      return {
        ok: false,
        reason: `vulnerable.ts did not trigger expected rule "${rule}" (found: ${vulnIds.join(', ') || 'none'})`,
      };
    }
  }
  const cleanIds = byFile.get('clean.ts') ?? [];
  if (cleanIds.length > 0) {
    return {
      ok: false,
      reason: `clean.ts produced ${cleanIds.length} vendored-rule finding(s), expected 0: ${cleanIds.join(', ')}`,
    };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Create the type declaration**

Create `scripts/check-semgrep-fixture.d.mts`:

```ts
// Type declarations for the .mjs self-test helper (allowJs is false in
// tsconfig, so the .mjs has no inferred types). Keeps the unit test fully
// typechecked without converting the script to TypeScript (it stays plain
// node so the CI semgrep job can run it without pnpm install). Mirrors
// scripts/lib/transcript.d.mts.
export const EXPECTED_RULES: readonly string[];

export type SemgrepResult = { path?: string; check_id?: string };
export type Verdict = { ok: true } | { ok: false; reason: string };

export function assertExpectedFindings(results: SemgrepResult[]): Verdict;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run scripts/__tests__/check-semgrep-fixture.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm typecheck 2>&1 | tail -3` — Expected: no errors (the `.d.mts` resolves the `.mjs` import).
Run: `pnpm biome check scripts/check-semgrep-fixture.mjs scripts/check-semgrep-fixture.d.mts scripts/__tests__/check-semgrep-fixture.test.ts 2>&1 | tail -3` — Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-semgrep-fixture.mjs scripts/check-semgrep-fixture.d.mts scripts/__tests__/check-semgrep-fixture.test.ts
git commit -m "feat(semgrep): pure assertExpectedFindings for the fixture self-test"
```

---

### Task 2: Orchestration shell (temp copy + scan + exit codes) + local alias

**Files:**
- Modify: `scripts/check-semgrep-fixture.mjs` (append the IO shell + `main()` + entry guard)
- Modify: `package.json` (add `lint:semgrep:selftest` script)

**Interfaces:**
- Consumes: `assertExpectedFindings`, `EXPECTED_RULES` from Task 1.
- Produces: a CLI entrypoint `node scripts/check-semgrep-fixture.mjs` exiting `0`/`1`/`2` per the Global Constraints.

- [ ] **Step 1: Append the orchestration shell to the script**

Append to `scripts/check-semgrep-fixture.mjs` (after the pure function, before EOF):

```js
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FIXTURE_DIR = 'tests/fixtures/semgrep';
const VENDORED_CONFIG = '.semgrep';

// Run Semgrep over scanDir with the vendored config only, JSON to stdout.
// SEMGREP_BIN (set by CI to the absolute console-script path) is honored
// exactly; otherwise probe the bare `semgrep` on PATH (local dev). No
// `python -m semgrep` fallback: semgrep ships a console script only.
function runSemgrepJson(scanDir) {
  const cmd = process.env.SEMGREP_BIN || 'semgrep';
  const res = spawnSync(
    cmd,
    ['scan', '--config', VENDORED_CONFIG, '--json', '--metrics', 'off', scanDir],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (res.error || res.status === null) {
    return { ok: false, reason: `semgrep failed to run: ${res.error?.message ?? 'no exit status'}` };
  }
  try {
    return { ok: true, json: JSON.parse(res.stdout) };
  } catch (e) {
    return { ok: false, reason: `unparseable semgrep JSON (stderr: ${res.stderr?.slice(0, 400) ?? ''}): ${e.message}` };
  }
}

function main() {
  const tmp = mkdtempSync(join(tmpdir(), 'semgrep-selftest-'));
  try {
    cpSync(join(FIXTURE_DIR, 'vulnerable.ts'), join(tmp, 'vulnerable.ts'));
    cpSync(join(FIXTURE_DIR, 'clean.ts'), join(tmp, 'clean.ts'));

    const scan = runSemgrepJson(tmp);
    if (!scan.ok) {
      console.error(`[check-semgrep-fixture] INFRA: ${scan.reason}`);
      process.exit(2);
    }
    const verdict = assertExpectedFindings(scan.json.results ?? []);
    if (!verdict.ok) {
      console.error(`[check-semgrep-fixture] RULE REGRESSION: ${verdict.reason}`);
      process.exit(1);
    }
    console.log('[check-semgrep-fixture] OK: vendored rules fire on vulnerable.ts; clean.ts is quiet.');
    process.exit(0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// Run only when invoked directly, not when imported by the unit test.
if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 2: Verify the unit test still passes (entry guard prevents main() on import)**

Run: `pnpm vitest run scripts/__tests__/check-semgrep-fixture.test.ts`
Expected: PASS (4 tests) — importing the module must NOT execute `main()` (no temp dir created, no scan run).

- [ ] **Step 3: Add the local alias to package.json**

In `package.json` `scripts`, add (next to the existing `lint:semgrep` entry, keep alphabetical grouping with the other `lint:` scripts):

```json
"lint:semgrep:selftest": "node scripts/check-semgrep-fixture.mjs",
```

- [ ] **Step 4: Smoke-run locally IF semgrep is installed (optional, non-gating)**

Run: `command -v semgrep >/dev/null && pnpm lint:semgrep:selftest || echo "semgrep not installed locally - CI verifies (authoritative)"`
Expected: either `[check-semgrep-fixture] OK: ...` (exit 0), or the skip message. A non-zero from a real run means a real problem — investigate before committing.

- [ ] **Step 5: Lint the changed files**

Run: `pnpm biome check scripts/check-semgrep-fixture.mjs package.json 2>&1 | tail -3`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-semgrep-fixture.mjs package.json
git commit -m "feat(semgrep): fixture self-test orchestration (temp scan, exit 1 rule / 2 infra)"
```

---

### Task 3: CI wiring (blocking self-test) + ADR

**Files:**
- Modify: `.github/workflows/ci.yml` (`semgrep` job: remove job-level `continue-on-error`, add the self-test step, make the report-only scan step soft)
- Modify: `DECISIONS.md` (ADR)

**Interfaces:**
- Consumes: `node scripts/check-semgrep-fixture.mjs` from Task 2; the existing `SEMGREP_BIN` env set by the install step.

- [ ] **Step 1: Remove the job-level `continue-on-error` and update the job comment**

In `.github/workflows/ci.yml`, the `semgrep` job header currently reads:

```yaml
  semgrep:
    name: Semgrep (static analysis, non-blocking)
    runs-on: ubuntu-latest
    # Non-blocking: report-only until the false-positive-rate baseline is recorded
    # in DECISIONS.md (see ADR). Promotion to blocking is a separate change.
    continue-on-error: true
    permissions:
```

Replace with (drop `continue-on-error`, reword the comment so it documents the split):

```yaml
  semgrep:
    name: Semgrep (static analysis)
    runs-on: ubuntu-latest
    # Split gating: the fixture self-test step below is BLOCKING (a broken
    # vendored rule fails the job); the report-only scan step carries its own
    # step-level continue-on-error so its FINDINGS stay non-blocking until the
    # FP-rate baseline is recorded (see DECISIONS.md). Promotion of the scan to
    # blocking on findings is a separate change.
    permissions:
```

- [ ] **Step 2: Insert the blocking self-test step before the report-only scan**

In `.github/workflows/ci.yml`, immediately BEFORE the `- name: Run Semgrep (SARIF, report-only)` step, insert:

```yaml
      - name: Self-test - vendored rules fire on the fixture
        # Blocking (no continue-on-error). Proves the content-pinned .semgrep
        # rules still fire: scans a temp copy of tests/fixtures/semgrep/{vulnerable,
        # clean}.ts (temp because .semgrepignore excludes tests/fixtures/) with
        # --config .semgrep ONLY, and fails the job if a vendored rule stopped
        # firing. A clean tree makes the report-only scan below find nothing
        # whether the rules work or not, so without this the gate is vestigial.
        # Exit 1 = rule regression, exit 2 = infra (semgrep missing/crash). Uses
        # the SEMGREP_BIN resolved by the install step above.
        run: node scripts/check-semgrep-fixture.mjs
```

- [ ] **Step 3: Make the report-only scan step soft (step-level `continue-on-error`)**

The `- name: Run Semgrep (SARIF, report-only)` step currently has only a `run:` (no `continue-on-error`, since it relied on the job-level flag). Add `continue-on-error: true` to THIS step so its findings stay non-blocking now that the job-level flag is gone. After editing, the step reads:

```yaml
      - name: Run Semgrep (SARIF, report-only)
        # Omit --error so semgrep exits 0 on findings and the step writes SARIF
        # reliably. Step-level continue-on-error keeps the real-tree scan's
        # FINDINGS non-blocking (the self-test step above is what gates). When
        # promoting to blocking: remove this continue-on-error AND add --error,
        # so semgrep exits 1 on findings and the step (and job) fail together.
        continue-on-error: true
        run: node scripts/run-semgrep.mjs --sarif semgrep.sarif
```

- [ ] **Step 4: Validate the workflow YAML parses**

Run: `node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); require('yaml').parse?.(y)||0; console.log('read ok', y.includes('Self-test - vendored rules'))"` — if `yaml` is unavailable, instead run `pnpm exec tsx -e "import {parse} from 'yaml'; import {readFileSync} from 'node:fs'; parse(readFileSync('.github/workflows/ci.yml','utf8')); console.log('yaml parse ok')"`.
Expected: parse succeeds; the self-test step name is present. (If neither `yaml` resolves, fall back to: `grep -n "Self-test - vendored rules\|continue-on-error" .github/workflows/ci.yml` and eyeball that job-level flag is gone and the two step-level placements are correct.)

- [ ] **Step 5: Add the ADR to DECISIONS.md**

Add at the top of the dated-entries list in `DECISIONS.md`:

```markdown
- **2026-06-20** - **Semgrep fixture self-test is now a BLOCKING CI step (closes the 2026-06-19 ADR TODO b).** The vendored, content-pinned rules (`.semgrep/owasp-top-ten.yml` `child-process-shell-injection`, `.semgrep/secrets.yml` `hardcoded-stripe-secret-key`) were never exercised in CI: a clean tree makes the report-only scan's "0 findings" identical whether the rules work or are silently broken (the same vestigial-gate failure as the Stryker runner). Fix: `scripts/check-semgrep-fixture.mjs` copies `tests/fixtures/semgrep/{vulnerable,clean}.ts` to a temp dir (temp because `.semgrepignore` excludes `tests/fixtures/`), scans with `--config .semgrep` ONLY (no registry packs - deterministic/offline so a blocking gate cannot flake on registry drift), and asserts each vendored rule fires on `vulnerable.ts` and `clean.ts` is quiet (per-rule + clean=0, stronger than the TODO's literal ">=1 finding"). Gating split: job-level `continue-on-error` removed; the new self-test step is blocking; the report-only scan step keeps a step-level `continue-on-error` so its FINDINGS stay non-blocking until the FP-rate baseline is recorded. Exit 1 = rule regression, exit 2 = infra (semgrep missing/crash) so a broken runner is not misread as a rule break. Verified by the negative proof: breaking a vendored rule locally makes `pnpm lint:semgrep:selftest` exit 1 naming the rule. _Reversible: restore the job-level `continue-on-error`, drop the self-test step, delete the script + test + alias - one revert commit._
```

- [ ] **Step 6: Em-dash + lint scan on the docs/config touched**

Run: `grep -n "—" .github/workflows/ci.yml DECISIONS.md docs/superpowers/plans/2026-06-20-semgrep-fixture-selftest.md && echo "EM-DASH - fix" || echo "no em-dash"`
Expected: `no em-dash`.
Run: `pnpm biome check package.json 2>&1 | tail -2` (ci.yml/DECISIONS.md are not biome-scoped; this confirms package.json from Task 2 is clean).

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml DECISIONS.md
git commit -m "ci(semgrep): blocking fixture self-test; report-only scan stays soft"
```

---

### Task 4: Negative proof + full verification (no new code)

**Files:** none (verification only; the plan doc itself is committed separately or with Task 3).

- [ ] **Step 1: Negative proof that the gate catches a real break (only if semgrep is installed locally)**

```bash
command -v semgrep >/dev/null || { echo "semgrep not local - rely on CI for the live scan; do the negative proof in CI by reading the self-test step log"; exit 0; }
# Temporarily break the secret rule's pattern, confirm the self-test fails naming it, then revert.
cp .semgrep/secrets.yml /tmp/secrets.yml.bak
perl -CSD -i -pe 's/sk_/zz_BROKEN_/g' .semgrep/secrets.yml
pnpm lint:semgrep:selftest; echo "exit=$?"   # expect exit=1 naming hardcoded-stripe-secret-key
cp /tmp/secrets.yml.bak .semgrep/secrets.yml  # revert
git diff --stat .semgrep/secrets.yml          # expect: no changes (reverted)
```
Expected: the broken run exits 1 with `RULE REGRESSION: vulnerable.ts did not trigger expected rule "hardcoded-stripe-secret-key"`; after revert, `git diff` shows `.semgrep/secrets.yml` unchanged. Record the observed output in the PR body.

- [ ] **Step 2: Full local verification**

Run: `pnpm typecheck && pnpm vitest run scripts/__tests__/check-semgrep-fixture.test.ts && pnpm biome check scripts package.json 2>&1 | tail -3`
Expected: typecheck clean, 4 tests pass, biome clean.

- [ ] **Step 3: Confirm the self-test passes in CI (authoritative live scan)**

After pushing, read the `semgrep` job's `Self-test - vendored rules fire on the fixture` step log: it must print `[check-semgrep-fixture] OK: ...` and the job must be green. This is the end-to-end proof the rules fire against real Semgrep. Record in the PR body.

---

## Self-Review

**1. Spec coverage:**
- Spec 3.1 (script: temp copy, vendored scan, exit codes) -> Task 2. PASS.
- Spec 3.2 (pure `assertExpectedFindings`, suffix match, `EXPECTED_RULES` single site) -> Task 1. PASS.
- Spec 3.3 (CI wiring: job flag removed, self-test step blocking, scan step soft) -> Task 3 Steps 1-3. PASS.
- Spec 3.4 (unit test: pass + 2 fail payloads) -> Task 1 Step 1. PASS.
- Spec 3.5 (`lint:semgrep:selftest`, not in verify/ci:local) -> Task 2 Step 3. PASS.
- Spec 3.6 (ADR) -> Task 3 Step 5. PASS.
- Spec 5 (negative proof) -> Task 4 Step 1. PASS.
- Architect refinement (scope clean=0 to vendored findings on temp paths) -> satisfied: the scan is `--config .semgrep` only, so every finding is a vendored finding; `assertExpectedFindings` groups by fixture basename. PASS.

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to" in any step. Every code step shows full code. PASS.

**3. Type consistency:** `assertExpectedFindings(results)` and `EXPECTED_RULES` names + the `{ ok: true } | { ok: false, reason }` verdict shape match across the script, the `.d.mts`, and the test. The `.mjs` import specifier (`../check-semgrep-fixture.mjs`) matches the file created in Task 1. CI step name string (`Self-test - vendored rules`) matches between insert (Task 3 Step 2) and the YAML validation (Step 4). PASS.
