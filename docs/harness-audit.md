# AI Engineering Harness Audit (2026-07-17)

> Read-only investigation of this repo's Claude Code + Codex harness. Evidence-cited, produced by a four-agent parallel inventory (Claude instruction/agent/skill surface, hooks/permissions, Codex surface, MCP/scripts/eval). No harness behavior was changed to produce this report. Fixes are proposed, not yet applied, per the audit-first decision.

## Executive summary

The harness is, on the whole, well-built: the review/verification chain is fail-closed and SHA-pinned, permissions are narrow and skill-scoped, and the MCP surface configured in-repo is read-only. The investigation surfaced one premise-level correction and a small number of high-blast-radius correctness gaps that are cheap and reversible to fix.

**The program's framing premise does not hold as stated.** It treats Claude Code and Codex as two live runtimes to unify. Evidence: Codex has **zero live surface on `main`** (no `AGENTS.md`, `.codex/`, `.agents/`, no CI step, no `package.json` script, no doc reference outside dated history). The only Codex artifacts are on two **unpushed local branches** (`chore/codex-mirror-sync`, `codex-work-backup`), and that mirror was already one gate-fix stale the day it was authored. So this is one live runtime (Claude Code) plus a dormant experiment. Whether the "runtime routing between Claude and Codex" half of the program is even in scope hinges on a fact only the owner holds: **is Codex actually used day to day?** That is decision A below and it gates roughly half the program.

The three highest-blast-radius correctness gaps, all reversible:
1. `.claude/agents/` (7 files) is **untracked in git** and is the *sole* registration of those agent names, including `architect-reviewer` which backs a hard-enforced hook. A fresh clone or `git clean` loses them with no error signal.
2. `bash-guard.sh` **fails open** on a JSON-parse failure, silently disabling every block it performs, including `gh pr merge` and force-push-to-`main` (which have no other gate).
3. `api-edit-marker.sh` **fails open** the same way, which can silently disable the security-auditor-before-push gate for an API edit.

## Method and scope

Four read-only agents (Sonnet) ran in parallel, each on an independent surface, each required to cite `file:line`. Confidence is high for file-level facts (verified against source), medium for the two owner-decision items (Codex usage, Upstash token semantics) which repo evidence alone cannot settle.

## Inventory

### Instruction surface
| Component | State | Verdict |
|---|---|---|
| `CLAUDE.md` (project, 254 lines) | tracked | keep; well-cited gates |
| `~/.claude/CLAUDE.md` (global, 150 lines) | tracked, repo-agnostic | keep |
| Duplicated rule: "does a gate already state this" | `CLAUDE.md:188` and `~/.claude/CLAUDE.md:147` | low-priority refine (self-referential duplication) |

### Agents (`.claude/agents/*.md`, 7 files)
**Untracked.** Verified as the sole registration of these names (frontmatter is byte-identical to the Agent-tool listing), not shadows of plugins. Each file is ~90% generic vendor-template boilerplate (a `context-manager` handshake and cross-agent references to agents that do not exist here) followed by a terse, load-bearing "Portfolio project context" tail.
- `architect-reviewer.md` carries the spec-gate protocol that `architect-gate.sh` mechanically requires. Highest risk of the seven.
- `performance-engineer.md`, `nextjs-developer.md` carry the repo's perf budgets that CLAUDE.md dispatches to by name.
- Verdict: **track in git (urgent)**, then **trim** the dead boilerplate.

### Skills (7, tracked)
All distinct, no overlaps. `pr-merge-gate` and `review-convergence` reference the CLAUDE.md-inline battery rather than restating it (correct). Verdict: keep all.

### Commands (4, tracked)
`commit.md`, `pr-metrics.md`, `ready-for-pr.md`: thin non-duplicative wrappers, keep. `merge.md`: duplicates `pr-merge-gate` "Quick sequence" instead of pointing to it; refine to a pointer (drift risk).

### Hooks (`.claude/hooks/*.sh`, 9)
| Hook | Event | Blocks? | Failure mode | Verdict |
|---|---|---|---|---|
| `bash-guard.sh` | PreToolUse/Bash | yes (exit 2) | **FAIL OPEN** on parse failure | **refine (top priority)** |
| `api-edit-marker.sh` | PostToolUse | records marker | **FAIL OPEN** on parse failure | **refine** |
| `api-security-push-guard.sh` | PreToolUse/Bash | yes | fail-closed (verified) | keep |
| `architect-gate.sh` | PreToolUse/Skill | yes | fail-closed (verified) | keep |
| `biome-format.sh` | PostToolUse | no (autofix) | fail-open by design (correct) | keep |
| `css-token-guard.sh` | PostToolUse | warn | duplicates `lint:css-tokens` in `verify` | refine-or-drop |
| `section-order-guard.sh` | PostToolUse | warn | duplicates `check:section-order` in `verify` | refine-or-drop |
| `learning-loop.sh` | SessionEnd | no | fail-open (correct, advisory) | keep |
| `session-context.sh` | SessionStart | no | graceful degrade (tested) | keep |

Test coverage gap: only `biome-format.sh` and `session-context.sh` have behavioral tests. The three blocking hooks (`bash-guard`, `api-security-push-guard`, `architect-gate`) have no test of their own block logic; `bash-guard`'s dangerous-command regexes have zero behavioral coverage anywhere. Violates the repo's own "verify a guard blocks with a live test" rule.

### Permissions (`.claude/settings.json`)
Narrow, skill-scoped `allow` (17 entries), no `Bash(*)`/MCP wildcards; `deny` is 3 `fallow fix` variants (a strict subset of what `bash-guard` already enforces); `defaultMode: acceptEdits`; the irreversible-op `ask` list correctly lives in global settings (repo-agnostic). Least-privilege respected. No config gap; the only robustness issue is the hook fail-open above.

### MCP (`.mcp.json`)
| Server | Access | Verdict |
|---|---|---|
| `context7` | read-only by construction (no write tool exists) | keep |
| `upstash` | claimed read-only via `${UPSTASH_READONLY_API_KEY}`, **unverified** | keep, **decision B** |

The Upstash claim (`DECISIONS.md:174`, self-labeled "PILOT, flagged for veto") is that a read-only key auto-disables state-modifying tools. But `mcp__upstash__redis_database_run_redis_commands` is a generic Redis executor, and Upstash's read-only flag is documented at the account/management level, a different scope than data-plane REST commands. No test or observed 403 corroborates the claim. This is exactly a "held by X without mutation-testing X" case.

### Scripts and eval
Review chain `battery-synthesis -> review-findings -> review-stamp -> review-learn`: steps 4 (stamp) and the ledger are fail-closed, SHA-pinned, transcript-cross-referenced. Two notes:
- `review-learn.ts` proposals accumulate with no consumption (live entries at 77-90 cycles, none actioned). Advisory by design, but the backlog needs triage or an escalation threshold.
- Step 3 (recording findings from the synthesis table into the ledger) is an honor-system boundary the stamp itself names ("cannot know about a finding you never recorded"). Accepted as a self-aware limit, not a fixable flaw.
- `agent-eval.ts` (platform-rule eval, weekly non-blocking) and `ask-eval.ts` (product eval, blocking, path-filtered) are correctly scoped.

### Codex surface
Zero on `main`. Dormant mirror on two unpushed local branches. The mirror design (`sync-codex.mjs`, single-source `CLAUDE.md -> AGENTS.md` with a scoped rewrite table and a `check:codex-sync` gate) is the correct low-drift shape *if Codex is used*, but it never merged, is already stale, and its sync loop misses `.claude/rules/` and `.claude/agents/`. Verdict: **decision A**.

## Current execution flow (as-built)

```
user prompt
  -> instruction load: global CLAUDE.md + project CLAUDE.md + path-scoped .claude/rules/api-boundary.md (on app/api edits)
  -> session-context.sh injects branch/PR/CI state at SessionStart
  -> skill dispatch: model-injected skill descriptions (no routing table); thinking-* + superpowers pre-gated in settings.allow
  -> agent dispatch: 7 local agent defs + plugin agents; model chosen per-call (now: reason about tier, per the PR #203 rule)
  -> hooks tighten at tool time: bash-guard/api-security-push-guard (PreToolUse Bash), architect-gate (PreToolUse Skill), api-edit-marker/biome-format/css-token/section-order (PostToolUse Edit|Write)
  -> review battery (4 agents) -> battery-synthesis -> review-findings ledger -> review-stamp (.review-passed = HEAD)
  -> .husky/pre-push: branch-name + stamp-match + API-marker + pnpm verify
  -> gh pr create -> validate-pr-body -> /claude-review convergence -> pr-merge-gate (owner merges)
```

There is no explicit model-routing or runtime-routing layer today: routing is by model-injected skill/agent descriptions and per-call judgment. That is the simplest shape and, given a single live runtime, likely the correct one; a routing table is only justified if Codex becomes a second live runtime (decision A).

## Findings, ranked by blast radius

| # | Finding | Category | Reversible? | Proposed fix |
|---|---|---|---|---|
| 1 | `.claude/agents/` untracked, sole registration, backs architect-gate | correctness | yes | `git add .claude/agents/` + commit |
| 2 | `bash-guard.sh` fails open. Root cause (found during the fix's review): it extracted the command from the top-level `command` key, but the real PreToolUse payload nests it under `tool_input.command` — so `CMD` was empty on *every* real invocation, making the guard a silent no-op in production (bare `npm`/`git add .`/`yarn` unblocked). Fixed here: read `tool_input.command` (matching sibling hooks) + fail-closed raw-scan fallback + real-payload-shape regression tests | security | yes | done (see `fix(hooks)` commits) |
| 3 | `api-edit-marker.sh` fails open (can disable security-audit gate) | security | yes | fail-closed/warn on parse failure |
| 4 | `.husky/pre-push:44-45` names 2 dead agents (`accessibility-tester`, `dependency-manager`) | doc-drift | yes | replace with the 4-role list from `architect-reviewer.md:338` |
| 5 | Upstash MCP write-scope claim unverified | security | yes | verify, or swap to a db-scoped read-only REST token (decision B) |
| 6 | 3 blocking hooks have no behavioral test; `bash-guard` regexes untested | test-coverage | yes | add block-logic tests to `.claude/hooks/__tests__/` |
| 7 | Codex: zero live surface; dormant unmerged mirror | strategic | yes | decision A: use it (rebase+finish+PR) or delete the 2 local branches |
| 8 | 7 agent files ~90% dead vendor boilerplate | simplification | yes | trim to role statement + portfolio context tail |
| 9 | `css-token-guard` + `section-order-guard` duplicate `verify` gates | simplification | yes | keep for edit-time feedback or drop (owner call) |
| 10 | `merge.md` duplicates `pr-merge-gate` Quick sequence | simplification | yes | replace with a pointer |
| 11 | `review-learn.ts` proposals accumulate (77-90 cycles), no consumption | process | yes | add escalation threshold or schedule manual triage |
| 12 | Duplicated "gate-hygiene" rule in project+global CLAUDE.md | simplification | yes | low priority; cut the abstract sentence from one side |
| 13-17 | `bash-guard.sh` used raw-substring greps, so it both (a) false-blocked a dangerous string appearing only inside a quoted argument like a commit message (13, hit live), and (b) was evaded by shell-tokenization-equivalent forms — all **verified** live once the extraction fix made the guard functional: quoted / double-spaced `gh "pr" merge` (14), quoted `git push --"force" origin main` (15), chained `npm install` (16), quoted `git add "-A"` / `git add "."` (17). A follow-up Opus+code-review battery then reproduced a further class the first tokenizer missed: no-space chaining (`x&&npm i`), newline-separated commands, command-position wrappers (`env`/`command`/`sudo`/`VAR=val npm`), and `git add :/`/`*` pathspecs. Mitigating context: `bash-guard` is a cooperative-agent guardrail, and the irreversible ops it names are *also* gated server-side (GitHub branch protection blocks force-push/direct-push to `main`; `gh pr merge` is owner-only) — the `git add`/`npm` blocks are the ones with no server-side backstop. **Fixed here:** extracted detection to `.claude/hooks/bash-guard-detect.py` — quote-aware newline normalization, `shlex.shlex(punctuation_chars=…)` operator-aware tokenizing, wrapper/`VAR=val` stripping, command-position matching, subshell segments — with a coarse fail-closed grep fallback only when python3 is unavailable, and regression tests covering every reproduced bypass plus the multi-line-commit non-block | security-hardening | yes | done |

## Decisions required (owner)

- **A. Do you actually use Codex day to day?** If yes: the runtime-routing half of the program is in scope, and the next step is to rebase `chore/codex-mirror-sync` onto current `main`, fix its `.claude/rules`/`.claude/agents` sync gap, and open it as a PR. If no: delete both local branches and drop runtime-routing from the program entirely (this is the simpler, likely-correct default given the evidence).
- **B. Upstash MCP read-only guarantee:** verify the account-key claim against Upstash docs, or swap to a database-scoped read-only REST token (narrower, independently verifiable). Recommend the swap.

## Proposed phased plan (fixes not yet applied)

Ordered by the decision framework (high-confidence, high-frequency, reversible first). Nothing here is implemented yet; the audit-first decision holds implementation until this plan is reviewed.

- **Phase B (correctness, do first):** findings 1, 2, 3, 4. All reversible, all high-blast-radius, none require a design choice. This is the smallest safe PR.
- **Phase C (simplification):** findings 8, 9, 10, 12. Reduces surface without changing behavior.
- **Phase D (hardening):** finding 6 (hook block-logic tests), finding 5 (Upstash token, pending decision B).
- **Phase E (process):** finding 11 (review-learn triage/escalation).
- **Routing/subagent architecture (program Phases 6-16):** contingent on decision A. If Codex stays out, the existing description-driven dispatch + per-call model judgment is the recommended architecture (Option A "minimal primary-agent harness" from the program), and no routing table is built. This is where a brainstorming pass belongs, after decision A.

## What this audit did not do

No behavior changed. Plugin-supplied MCP write surfaces (Vercel/Linear/GitHub) are out of `.mcp.json` scope. Test counts and runtime metrics were not re-measured. The two owner decisions (A, B) cannot be settled from repo evidence alone.
