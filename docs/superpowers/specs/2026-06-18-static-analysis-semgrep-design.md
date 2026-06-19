# Static Analysis (Unit B) — Design Spec

- **Date:** 2026-06-18
- **Status:** Approved (architect-reviewer PASS 2026-06-19) — plan written
- **Branch:** `feat/platform-gaps-2026-semgrep` (sub-PR into `feat/platform-gaps-2026`)
- **Author:** Erik Cunha

## 1. Context & goal

Benchmark gap #1 (highest raw impact, score 83): the platform *asserts* security is "implicit on every change" but nothing **measures** it per-diff. The 5-agent review battery *reasons about* vulnerabilities; static analysis *measures* them (taint tracking, injection, secrets) deterministically, with no hallucination. Surfaced independently in both the MCP and community research streams.

### Goal

Wire **Semgrep CLI** into the local + CI gate chain as the measuring layer, with the Trail of Bits `semgrep` skill as the agent interface. The CLI-in-CI is the leverage; the skill is just the interface.

### Non-goals / deferred

- **Semgrep MCP** (interactive) — deferred to a later phase (the gate is the value; interactive use is secondary).
- **CodeQL** variant analysis — deferred to Phase 4.
- No change to the 5-agent battery; Semgrep is a deterministic *complement*, not a replacement.

## 2. Components

1. **Ruleset.** Use Semgrep registry rulesets pinned by digest: `p/typescript`, `p/react`, `p/nextjs`, `p/owasp-top-ten`, `p/secrets`. Optionally a small repo-local `.semgrep/` for project rules (e.g., enforce the API envelope). Scope scan paths to `app/`, `lib/`, `components/`, `scripts/` — exclude `node_modules`, `.next`, `out`, test fixtures.
2. **Invocation.** A `scripts/run-semgrep.mjs` wrapper (or a thin `pnpm` script) calling the pinned Semgrep CLI with `--error` for CI and SARIF output. Semgrep is a Python tool: CI uses the official `semgrep` GitHub Action (or `pip install semgrep==<pinned>`); local use is optional (CI is authoritative).
3. **`pnpm lint:semgrep`** added to `package.json`; added to the CI workflow as its own job. **Initially non-blocking (report-only)** per the CLAUDE.md false-positive-budget rule; promoted to blocking once the false-positive rate on this codebase is measured.
4. **ToB skill.** Copy the Trail of Bits `semgrep` `SKILL.md` into `.claude/skills/semgrep/` as the agent interface (run-on-diff, interpret SARIF).
5. **ADR** in DECISIONS.md recording the addition + reversibility.

## 3. Wiring

- `package.json`: add `lint:semgrep`; add to the `ci:local` chain only after promotion to blocking (until then it runs in CI as a separate non-blocking job to avoid taxing every local run).
- CI workflow (`.github/workflows/ci.yml`): a `semgrep` job, `continue-on-error: true` initially, uploading SARIF to the GitHub code-scanning tab.
- Pin the Semgrep version and ruleset digests (mirrors the repo's `--frozen-lockfile` / exact-pin discipline).

## 4. Failure-mode checklist (thinking-inversion)

| Failure mode | Mitigation |
|---|---|
| False-positive noise trains bypass | Start non-blocking (report-only); promote to blocking only after FP rate measured; tune/allowlist before promotion |
| Secrets ruleset fires on test fixtures | Path-exclude fixtures + `.semgrepignore`; nosemgrep comments only with justification |
| Ruleset drift changes findings silently | Pin ruleset by digest + Semgrep version |
| Semgrep not installed locally | CI is authoritative; local run optional + documented |
| Slow scan on full tree | Scope paths; diff-aware `--baseline-commit` in CI |
| Overlap/duplication with battery security-auditor | Framed as complement (measures vs reasons); no battery change |

## 5. Testing (TDD)

Behavioral, per STANDARDS Ch.4:
- A deliberately vulnerable fixture (e.g., an injection sink, a hardcoded secret) produces a Semgrep finding; a clean equivalent produces none.
- The `lint:semgrep` wrapper exits non-zero on findings in `--error` mode and zero when clean.
- SARIF output is well-formed (parseable).

## 6. Verification before completion

`pnpm lint:semgrep` runs green on the current clean tree; the vulnerable fixture is caught; CI job uploads SARIF; the FP baseline is recorded before any blocking promotion.

## 7. Reversibility

Remove the `lint:semgrep` script, the CI job, the `.semgrep/` rules, and the skill. No production-code impact, no bundle impact. ADR records the undo.

## 8. Status / next steps

Draft → architect-reviewer gate → writing-plans → TDD implementation (held; planning phase).
