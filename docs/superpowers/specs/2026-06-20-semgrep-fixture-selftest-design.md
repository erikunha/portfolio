# Semgrep Fixture Self-Test Gate - Design Spec

- **Date:** 2026-06-20
- **Status:** Approved (brainstorming) - pending architect-reviewer gate
- **Branch:** `ci/semgrep-fixture-selftest` (standalone PR to main)
- **Author:** Erik Cunha

## 1. Context & goal

Closes the tracked follow-up in DECISIONS.md (2026-06-19, the Semgrep gate ADR) TODO (b):

> wire the vulnerable-fixture trigger assertion into the CI `semgrep` job - scan a temp copy of `tests/fixtures/semgrep/vulnerable.ts` and assert >= 1 finding - so a broken vendored rule cannot ship silently (the `test` CI job has no Semgrep, so the rule-fires-correctly property is currently unverified in CI).

**The gap.** The `semgrep` CI job scans `app lib components scripts` with vendored rules (`.semgrep/owasp-top-ten.yml`, `.semgrep/secrets.yml`) plus registry packs, report-only. The vendored rules are content-pinned, so a bad edit (a typo'd pattern, a broken `metavariable-regex`) is a live risk. Because our tree is clean, the real scan finds nothing whether the rules work or not: "rules broken -> 0 findings" is indistinguishable from "rules fine -> 0 findings." The fixtures `vulnerable.ts` (should trigger both rules) and `clean.ts` (should trigger none) exist precisely to prove the rules fire, but **nothing currently scans them** - not in CI, not locally. This is the same vestigial-gate failure mode that left the Stryker mutation runner producing zero signal for weeks (DECISIONS 2026-06-20), here applied to the Semgrep rules.

**Goal.** Prove, on every CI run and blocking, that the vendored Semgrep rules still fire on a known-vulnerable input and stay quiet on a known-clean input. A broken vendored rule must fail CI, not ship.

## 2. Clarifications resolved

Design questions closed during the brainstorming interview:

- **Blocking vs report-only self-test?** -> **Blocking.** A non-blocking self-test reproduces the exact silent-gate failure this work exists to close. The self-test asserts a different property (the scanner + rules work) than the report-only scan (what the scan found), and that property regressing is a real defect in the security gate.
- **Assertion strength: literal ">= 1 finding" vs per-rule?** -> **Per-rule + clean=0.** ">= 1 total" stays green if one of the two vendored rules breaks while the other still fires (under-test). Assert each vendored rule category fires on `vulnerable.ts` (command-injection >= 1 AND secret >= 1) and that `clean.ts` yields 0 (catches the opposite failure: a rule that over-matches). Both fixtures already exist for this.
- **Which config does the self-test scan with?** -> **Vendored `.semgrep` only**, not the registry packs (`p/typescript`, `p/react`, `p/nextjs`). The self-test proves OUR content-pinned rules; registry packs are registry-latest, out of our control, and add network + nondeterminism. Deterministic, offline self-test.
- **Where does the assertion live?** -> A standalone Node script (`scripts/check-semgrep-fixture.mjs`) invoked by a CI step and runnable locally, mirroring the existing `scripts/run-semgrep.mjs` pattern. Keeps logic out of YAML and unit-testable.

## 3. Components

### 3.1 `scripts/check-semgrep-fixture.mjs` (new)

Responsibility: prove the vendored rules fire correctly against the fixtures.

Flow:
1. Copy `tests/fixtures/semgrep/vulnerable.ts` and `clean.ts` to a fresh OS temp dir (via `fs.mkdtemp`), outside `.semgrepignore`'s `tests/fixtures/` exclusion.
2. Run Semgrep against the temp dir with `--config .semgrep` only, `--json`, `--metrics off`, honoring `SEMGREP_BIN` exactly the same way `run-semgrep.mjs` does (no fallback when set; bare `semgrep` probe otherwise).
3. Parse the JSON, pass `results` to the pure assertion function (3.2).
4. Clean up the temp dir (best-effort, in a `finally`).
5. Exit 0 if assertions pass; exit 1 with a message naming the failed expectation; exit 2 on infrastructure failure (semgrep not found, scan crashed, unparseable output) - distinct code so a broken runner is not read as a rule regression.

### 3.2 `assertExpectedFindings(results)` - pure function (in the script, exported)

Input: the array of Semgrep `results` objects (each has `check_id` and `path`).
Returns: `{ ok: true } | { ok: false, reason: string }`.

Expectations (keyed on the fixture file the finding is on and the rule id):
- `vulnerable.ts`: at least one finding whose `check_id` ends with `child-process-shell-injection` (the owasp-top-ten rule) AND at least one ending with `hardcoded-stripe-secret-key` (the secrets rule). Match by `check_id` suffix, because Semgrep namespaces a local-config rule id with its file path (e.g. `.semgrep.owasp-top-ten.child-process-shell-injection`); the suffix is the stable part. The two expected ids live in one named constant `EXPECTED_RULES = ['child-process-shell-injection', 'hardcoded-stripe-secret-key']`; if a rule file renames its id, this constant is the single update site and the self-test fails loudly until it is synced.
- `clean.ts`: zero findings.

Pure (no I/O), so unit-testable against canned `results` payloads.

### 3.3 CI wiring - `.github/workflows/ci.yml` `semgrep` job

- Remove `continue-on-error: true` from the **job**.
- Add `continue-on-error: true` to the **"Run Semgrep (SARIF, report-only)"** step only.
- Insert a new step **"Self-test: vendored rules fire on fixture"** after the install step and before the report-only scan, running `node scripts/check-semgrep-fixture.mjs`, with **no** `continue-on-error` -> its non-zero exit fails the job.
- Install step and SARIF upload step unchanged.

Net: the install step failing (no scanner) or the self-test failing (rules don't fire) fails the job; the report-only scan's findings never fail the job.

### 3.4 `scripts/__tests__/check-semgrep-fixture.test.ts` (new, TDD)

Vitest unit test on `assertExpectedFindings`:
- PASS payload: results containing a command-injection finding on `vulnerable.ts`, a secret finding on `vulnerable.ts`, and nothing on `clean.ts` -> `{ ok: true }`.
- FAIL payload (secret rule broke): command-injection finding only, no secret finding -> `{ ok: false }` with a reason naming the missing secret rule.
- FAIL payload (over-match): a finding on `clean.ts` -> `{ ok: false }` naming the clean-fixture violation.

### 3.5 `package.json`

Add `lint:semgrep:selftest`: `node scripts/check-semgrep-fixture.mjs` for local use. Not added to `verify`/`ci:local` (it needs Semgrep installed, same reason `lint:semgrep` is excluded).

### 3.6 DECISIONS.md

ADR: TODO (b) closed; blocking-self-test choice and rationale; vendored-config-only scope; reversibility (revert the job + delete the script/test).

## 4. Failure-mode checklist (thinking-inversion)

| Failure mode | Mitigation |
|---|---|
| Self-test passes while a rule is silently broken (the original gap, reintroduced) | Per-rule assertion: command-injection AND secret each asserted >= 1; a single-rule break fails |
| Rule over-matches everything (false-positive regression) but self-test only checks vulnerable.ts | Assert `clean.ts` yields 0 findings - the symmetric property |
| Broken Semgrep install read as a rule regression (misleading failure) | Exit code 2 for infra failure vs exit 1 for assertion failure; distinct messages |
| Self-test scans the real tree / registry packs -> nondeterministic, networked, flaky-blocking | Scan ONLY the temp fixture dir with `--config .semgrep`; no registry packs, no network |
| `.semgrepignore` excludes `tests/fixtures/`, so scanning the fixture in place finds nothing | Copy to an OS temp dir outside the ignore path before scanning |
| Hardcoded rule-id strings drift from the vendored rule files | Derive expected ids from a single named constant; if a rule file renames its id, update one place (and the self-test fails loudly until then - which is correct) |
| Temp dir leaks on crash | `finally` cleanup; `mkdtemp` under the OS temp root is GC'd by the runner anyway |
| Job-level `continue-on-error` removal makes a flaky registry-pack fetch in the report-only step block merges | The report-only step keeps step-level `continue-on-error: true`; only the self-test (vendored, offline) is blocking |
| Self-test green locally but the CI install resolves a different Semgrep | Same pinned `semgrep==1.97.0` + `SEMGREP_BIN` resolution as the existing job; self-test runs in the same job after the same install |

## 5. Testing & verification

- Unit: `assertExpectedFindings` (3.4) - pass + two distinct fail payloads.
- Integration (CI): the self-test step runs the real scan on the fixtures every CI run; a green run proves the rules fire end-to-end. Verified on the PR via a `workflow_dispatch` / PR-triggered CI run showing the self-test step passing.
- Negative proof (manual, once, documented in the PR body): temporarily break a vendored rule locally, run `pnpm lint:semgrep:selftest`, confirm it exits non-zero naming the rule; revert. Confirms the gate actually catches a break.

## 6. Out of scope

- Promoting the Semgrep gate (or mutation gate) to blocking on findings - separately data-gated on the FP-rate baseline (DECISIONS 2026-06-19), unchanged here.
- Testing registry packs.
- New fixtures or new rules.
- The richer SARIF content-assertion TODO (a) (">= 1 `runs[]` entry else warning") - already partially handled by the `hashFiles` upload guard; not in this unit.

## 7. Reversibility

Fully reversible: restore the job-level `continue-on-error`, drop the self-test step, delete `scripts/check-semgrep-fixture.mjs` + its test + the `package.json` alias. No production surface, no data migration. _Reversible with one revert commit._
