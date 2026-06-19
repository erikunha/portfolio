# Fast-Feedback Hooks (Unit A) — Design Spec

- **Date:** 2026-06-18
- **Status:** Approved (brainstorming + architect-reviewer PASS 2026-06-19) — plan written
- **Branch:** `feat/platform-gaps-2026-hooks` (sub-PR into integration branch `feat/platform-gaps-2026`)
- **Author:** Erik Cunha

## 1. Context & goal

A discovery-first benchmark of the 2026 Claude Code ecosystem (five parallel research streams: platform inventory, official Anthropic, MCP landscape, community, elite-team practice) assessed `erikunha.dev`'s AI-engineering platform against the field. The benchmark — full report in `~/Documents/claude-code-ecosystem-benchmark-2026.md` — rated the platform "reference-architecture-grade" and produced a ruthless shortlist of genuine gaps rather than a pile of additions, because for a mature platform "more" is usually net-negative (extra agent descriptions degrade dispatch routing; extra MCP servers widen the injection surface).

The gap list decomposes into 7 independent buildable units, sequenced by the benchmark's leverage formula `(Impact × Frequency × Confidence × Long-Term Leverage) ÷ (Complexity × Maintenance × Risk)`:

| Order | Unit | Score |
|---|---|---|
| **A (this spec)** | **Fast-feedback hooks** | **225** |
| B | Static analysis (Semgrep/CodeQL) in CI | 83 |
| C | Prompt/agent eval harness | 42 |
| D | Serena LSP MCP + vetted agents | 27 |
| F | Specs-as-artifacts (mostly already done) | 27 |
| G | Sentry MCP (decision-gated; conflicts with rejected-infra ADR) | 24 |
| E | Mutation testing (StrykerJS, API-boundary-scoped) | 14 |

Unit A ranks first on **leverage-per-cost**: it is cheap, frequent, and near-zero-risk. The benchmark found the existing hook layer **mature on the blocking/security axis** (`bash-guard`, `architect-gate`, `api-security-push-guard`, pre-commit Biome, pre-push verify) but **thin on the fast-feedback axis**. Unit A closes that one axis.

### Goal

Add two PostToolUse/SessionStart hooks that give cheap continuous feedback during a session, following the existing project hook conventions (read `tool_input.file_path` from stdin, scope by path, `exit 0` non-blocking).

### Non-goals

- The read-only auto-allow hook (PermissionRequest) is explicitly **out of scope** — it is a no-op under the repo's `"defaultMode": "acceptEdits"`, where Read/Glob/Grep do not prompt. YAGNI.
- No changes to the blocking-gate hooks, Husky hooks, or CI. Unit A is local-session feedback only.
- Units B–G are separate specs; this document does not design them.

## 2. The two hooks

### 2.1 `biome-format.sh` — PostToolUse `Edit|Write`

**Behavior:** on each agent edit, apply Biome's **mechanical** fixes (formatting + import organization) to the edited file so formatting and import-order never surprise at the pre-commit `biome check` gate. Lint violations are deliberately **not** auto-fixed (see Decision).

- Read `tool_input.file_path` from stdin via python3 (identical extraction to `css-token-guard.sh` / `section-order-guard.sh`).
- Guard by extension: run only when the path ends in `.ts .tsx .js .jsx .json .jsonc .css`. All other paths (`.md`, `.mdx`, images, lockfiles) are skipped.
- Resolve repo root (`git rev-parse --show-toplevel`), then run the repo-local Biome binary: `"$REPO_ROOT/node_modules/.bin/biome" check --write --linter-enabled=false --no-errors-on-unmatched "$FILE"`.
- Always `exit 0`. On any error (Biome missing, file gone, parse error), fail silently — never block the edit.

**Command choice (corrects architect-reviewer finding #1).** The pre-commit gate is `pnpm check` = `biome check .` (verified in `package.json` + `.husky/pre-commit`), and `biome.json` has `assist.actions.source.organizeImports: on`. Plain `biome format --write` does **not** organize imports, so a "formatted" file could still fail pre-commit on import order — defeating the hook's purpose. The fix is `biome check --write`, which applies the formatter **and** the assist (organizeImports). The linter is explicitly disabled (`--linter-enabled=false`) as a deliberate **scope** choice: the hook applies strictly mechanical fixes (formatting + import organization) and leaves ALL lint findings — including `noUnusedImports` / `noUnusedVariables` — as a conscious pre-commit gate. (Note: those two rules' autofix is an **unsafe** fix, applied only under `biome check --write --unsafe`; plain `biome check --write` runs safe fixes only and does **not** delete unused imports. Disabling the linter is therefore not about preventing auto-deletion under plain `--write` — it is about keeping the hook purely mechanical so lint remains a conscious gate.) So the hook handles mechanical cleanup (format + import organization) only; **lint findings remain a conscious gate** at pre-commit, by design.

**Decision (user-approved):** **write** mode (not check-and-report). The residual desync risk (a follow-up `Edit`'s `old_string` failing to match after reformat/import-sort) is accepted and mitigated, because (a) the agent writes near-formatted code so Biome's diff is minimal/idempotent, (b) the harness re-reads file state, (c) the scope is a single file, and (d) disabling the linter keeps the hook to strictly mechanical fixes (formatting + import organization), leaving every lint finding as a conscious pre-commit gate rather than a hook-applied mutation.

### 2.2 `session-context.sh` — SessionStart (new hook array)

**Behavior:** inject live git + PR + CI state as `additionalContext` at session start, additive to the existing `.remember/` handoff and plugin SessionStart hooks (which carry work-state but not live git/CI state). Closes the "acting on a stale branch / unaware CI is red" error class.

- Emit, as `additionalContext`: current branch, ahead/behind vs upstream, uncommitted file count, open PRs and their CI status.
- `gh` calls (open PRs, CI status) wrapped in a short timeout (e.g. `timeout 5`); on failure or unauthenticated `gh`, **fall back to git-only** output (branch, ahead/behind, uncommitted, last commit subject). Fail-silent, never error the session.
- Guard: if not inside a git repo, emit nothing and exit cleanly.

**Output contract (pins architect-reviewer finding #3).** No existing repo hook emits structured output, so the envelope is specified here rather than inferred. The hook prints to stdout a single JSON object using the SessionStart `additionalContext` contract:

```json
{"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "[session-context]\nbranch: <name> (<ahead> ahead, <behind> behind)\nuncommitted: <n> files\nopen PRs: <list or 'none'>\nlast CI: <status> (<sha>)"}}
```

The `additionalContext` value is the human-readable multi-line block; the surrounding JSON is the machine contract Claude Code consumes. The git-only fallback emits the same envelope with the PR/CI lines omitted.

**Decision (user-approved):** Full git + PRs + CI payload (not git-only-lightweight, not skip). The ~1–2s `gh` latency is a one-time per-session cost justified by catching stale-branch / red-CI errors.

## 3. Wiring

`.claude/settings.json`:
- Append `biome-format.sh` as the 4th hook in the existing `PostToolUse` → `matcher: "Edit|Write"` array.
- Add a new `SessionStart` array with `session-context.sh`. (Project `settings.json` currently has no `SessionStart` entry; the existing SessionStart hooks are global/plugin-level, so this is additive and non-conflicting.)

Both scripts live in `.claude/hooks/`, `chmod +x`, with a header comment block explaining purpose + history (matching every existing hook in that directory).

## 4. Failure-mode checklist (thinking-inversion)

Each becomes a guard or a test:

| Failure mode | Mitigation |
|---|---|
| Format desync on rapid same-file edits | Single-file scope; Biome idempotent on near-clean code; harness re-reads state |
| **`biome format` ≠ `biome check` — import-order still fails pre-commit** | Use `biome check --write` (formatter + assist/organizeImports), not `format`; this is the corrected command (§2.1) |
| **Hook applies a non-mechanical (lint) fix the agent didn't intend** | Disable the linter (`--linter-enabled=false`) as a deliberate mechanical-only scope choice; only format + import-organization apply, all lint findings stay a conscious pre-commit gate. (Plain `--write` would not delete unused imports anyway — that autofix is unsafe-only — but disabling the linter keeps the hook unambiguously mechanical.) (§2.1) |
| **PostToolUse latency on every edit** | Biome single-file run is sub-100ms; accepted as synchronous in the edit loop, mirroring the bounded `gh timeout` for `session-context` |
| Biome run on a non-Biome file (`.md`, image) | Extension allow-list guard |
| File deleted/moved between edit and hook | `exit 0` on Biome non-zero; fail-silent |
| Hook's own write re-triggers PostToolUse (infinite loop) | Cannot happen — hook file writes are not tool calls; no PostToolUse recursion |
| `biome` binary missing (fresh clone, no install) | Guard on `node_modules/.bin/biome` existence; skip if absent |
| `gh` unauthenticated or slow | `timeout` + git-only fallback; fail-silent |
| Not in a git repo | Repo guard; emit nothing |
| SessionStart output format wrong (context not injected) | Use documented hook `additionalContext` JSON output; verify in a live session before declaring done |

## 5. Testing (TDD — tests first)

Bash-hook behavioral tests that pipe mock JSON to stdin and assert output / side-effects:

- **`biome-format`:** given a deliberately mis-formatted fixture (`.ts`), the hook leaves it Biome-clean (formatting applied); given a fixture with **out-of-order imports**, the hook organizes them (proves `check --write` assist runs, not just `format`); given a fixture with an **unused import**, the import is **still present** after (proves the linter is disabled — no semantic mutation); given an already-clean fixture, the file is byte-identical after; given a `.md` path, Biome is never invoked (no write).
- **`session-context`:** emits the expected git fields on a known repo state and the exact `hookSpecificOutput` JSON envelope (§2.2); with `gh` stubbed to fail, falls back to git-only output and still exits 0; outside a repo, emits nothing.

**Test-infra notes (pins architect-reviewer finding #3b):**
- The repo has **no existing bash-hook test harness** — this is greenfield infra; the plan must create the runner, not assume one.
- The `gh`-failure stub is a **PATH shim** (a temp dir prepended to `PATH` containing a `gh` script that exits non-zero), not an env toggle — deterministic and hermetic.
- Harness mechanism (a `*.test.sh` runner vs a Vitest test shelling out) is chosen in writing-plans. Assertions are behavioral (observable output / file state), per STANDARDS Ch.4.

## 6. Verification before completion

- `biome-format` proven by the formatting fixture test (before/after byte comparison).
- `session-context` proven by a live session showing the injected `[session-context]` block.
- Both hooks confirmed wired by inspecting `settings.json` and triggering each event once.
- No regression to existing PostToolUse hooks (section-order, css-token, api-edit-marker still fire).

## 7. Reversibility

Fully reversible: remove the two `.claude/hooks/*.sh` files and their `settings.json` entries. No data migration, no CI change, no external dependency. An ADR bullet will record the addition with this reversibility note.

## 8. Status / next steps

Brainstorming complete and user-approved. Next: architect-reviewer gate → writing-plans → TDD implementation on `feat/platform-gaps-2026-hooks` → sub-PR into `feat/platform-gaps-2026`.
