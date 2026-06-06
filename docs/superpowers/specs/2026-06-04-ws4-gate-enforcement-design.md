# WS4: Make Every Gate Mechanically Real

> Status: DRAFT
> Date: 2026-06-04
> Workstream: WS4 Make Every Gate Mechanically Real
> Parent: ../specs/2026-06-04-platform-mastery-program-design.md
> PR order: 4 of 8
> Delivery: standalone PR to main

## Context

The CLAUDE.md "hard gates" are a mix of mechanically enforced rules and honor-system claims. The audit (parent spec, drift table, High-fragility row) verified the gap: several gates that read as enforced are only convention, held up by the model remembering CLAUDE.md on each turn.

What is actually enforced today (verified in this repo):

- **Bash safety guards.** `.claude/hooks/bash-guard.sh`, wired as a `PreToolUse` `command` hook on `matcher: "Bash"` in `.claude/settings.json`, blocks broad `git add`, npm/yarn, `gh pr merge`, force-push-to-main, and non-read-only `fallow` with `exit 2`. These are real.
- **CSS / section-order guards.** `.claude/hooks/section-order-guard.sh` and `.claude/hooks/css-token-guard.sh`, wired as `PostToolUse` `command` hooks on `matcher: "Edit|Write"`, run lint scripts. Note: both currently `exit 0` unconditionally (warn-only), even on a real violation; they surface text but never block.
- **Review stamp.** `.husky/pre-push` blocks the push unless `.review-passed` exists and its contents equal HEAD SHA. `.husky/post-commit` runs `rm -f .review-passed`, so a new commit clears the stamp. `pnpm review:stamp` is literally `git rev-parse HEAD > .review-passed`.

What is honor-system today (the WS4 target):

1. **5-agent battery before push.** CLAUDE.md line 183 claims `pr-review-toolkit:review-pr` + `accessibility-tester` + `security-auditor` + `performance-engineer` + `dependency-manager` all ran before `pnpm review:stamp`. The stamp proves only that `git rev-parse HEAD > .review-passed` ran. It is a rubber stamp: an agent that writes the stamp without dispatching any reviewer satisfies the pre-push hook.
2. **architect-reviewer before writing-plans.** CLAUDE.md line 240 requires `architect-reviewer` to return `GATE_RESULT: PASS` before `superpowers:writing-plans` proceeds. No artifact, no interception. Pure convention.
3. **security-auditor on API edits.** CLAUDE.md lines 59-60 and STANDARDS.md Ch.9 require `security-auditor` after editing `app/api/**`, `lib/rate-limit.ts`, `proxy.ts`. No artifact ties an API edit to an audit having run.
4. **gates:runtime before push for non-docs changes.** CLAUDE.md line 184 requires `pnpm gates:runtime` for any non-docs push. `.husky/pre-push` runs `pnpm verify` only, never `gates:runtime`. Honor-system.

Two project invariants constrain every hook in this workstream:

- **The exit-2 rule.** A `PreToolUse` `command` hook that must BLOCK a tool call exits code **2**. Exit **1** is a non-blocking warning (the tool still runs). Exit **0** allows. This is why the CSS guards (which `exit 0`) do not block, and is a documented past defect (memory: "PreToolUse hooks block on exit 2"; all bash-guard guards were warn-only until fixed 2026-05-30). Any new blocking guard in WS4 must `exit 2` on the block path.
- **The live-verification rule.** A guard is proven to block by a LIVE attempt that observes the tool was stopped, never by reading the guard's printed `[BLOCKED]` message. A guard can print `[BLOCKED]` and still `exit 0`. Every gate added here ships with a documented live-block procedure (Test strategy).

## Goal

Make every gate that CLAUDE.md *claims* mechanically real, or downgrade the claim to "convention" in the same PR. The invariant is: **no claim outlives its enforcement.** After WS4, a reader of CLAUDE.md can trust that every line written as a "hard gate" is backed by a hook, a husky script, or a script-level refusal that blocks live, and every line that is genuinely advisory is labeled "convention."

## Gate inventory

| Claimed gate | Current enforcement | Target mechanism | Hook event + type | Blocks? |
|---|---|---|---|---|
| 5-agent review battery ran before stamp | `review:stamp` writes the file unconditionally; pre-push checks file == HEAD only | `scripts/review-stamp.ts` refuses to write `.review-passed` unless the session transcript shows all five agents dispatched at/after the last commit; pre-push unchanged | N/A (script-level refusal, invoked by `pnpm review:stamp`); plus optional `PreToolUse` `command` guard on the raw `git ... > .review-passed` bypass | Yes (push blocked because stamp absent) |
| security-auditor after API-surface edit | none | `PostToolUse` `command` hook records a "dirty" marker when `app/api/**`, `lib/rate-limit.ts`, `proxy.ts` is edited; a `PreToolUse` `command` guard on `git push` blocks until the transcript shows `security-auditor` ran after the marker | PostToolUse `command` (record) + PreToolUse `command` (block push) | Yes (push blocked) |
| architect-reviewer PASS before writing-plans | none | `PreToolUse` `command` hook on the `Skill` tool, matching the `writing-plans` invocation, blocking unless the transcript shows `architect-reviewer` returned `GATE_RESULT: PASS` in this session | PreToolUse `command` (matcher `Skill`) | Yes (skill invocation blocked) |
| gates:runtime before non-docs push | pre-push runs `pnpm verify` only | `.husky/pre-push` runs `pnpm gates:runtime` when the push range contains non-docs files (and an env escape hatch for the docs-only and CI cases) | husky `pre-push` (git, not a Claude hook) | Yes (push blocked) |
| CLAUDE.md gate-claim language | prose asserts enforcement that does not exist | Reword each now-enforced claim to cite its artifact; label any residual advisory rule "convention" | N/A (documentation) | N/A |

Design honesty note on the "agent / prompt hook type" locked decision: see Approach §1 and §2. The repo's only observable hook type is `command` (verified in `.claude/settings.json`). The Claude Code hook event taxonomy includes `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, and handler types `command` / `http` / `mcp_tool` / `prompt` / `agent`. The blocking semantics that this repo has actually verified live are the `command` type with `exit 2` on `PreToolUse`. Whether a `prompt` or `agent` handler type can itself *block* a `PreToolUse` event (and with what decision contract) is **not directly observable in this repo**, and the project's own rule is to verify a block live rather than trust documentation. WS4 therefore specifies `command` hooks that *read the transcript* as the load-bearing mechanism, and treats an `agent`/`prompt`-type semantic verifier as an optional enrichment to be adopted only after its block behavior is proven live at implementation time. This satisfies the locked "sophisticated, not brittle grep" intent by keying on the structured `subagent_type` transcript field (a stable JSON key) rather than free-text greps of model prose, while keeping the blocking path on the one mechanism this repo has proven.

## Approach

Shared primitive: **transcript inspection.** Every `PreToolUse` / `PostToolUse` `command` hook receives a JSON object on stdin. The existing guards read `command` and `tool_input.file_path` from it (see `bash-guard.sh`, `section-order-guard.sh`). The hook input also carries `transcript_path` (absolute path to the current session JSONL) and `cwd`. Transcripts live at `~/.claude/projects/<project-slug>/<session-uuid>.jsonl`, one JSON object per line. Verified in this repo: a Task-tool subagent dispatch is recorded as a line containing `"subagent_type":"<name>"` (observed values in live transcripts: `"Explore"`, `"general-purpose"`). This `subagent_type` key is the stable, structured signal the WS4 verifiers key on, not a free-text grep of agent output.

A shared helper `scripts/lib/transcript.mjs` exposes:
- `readTranscript(transcriptPath)` -> array of parsed JSONL records (tolerant: skips malformed lines).
- `agentsDispatchedSince(records, predicate)` -> set of `subagent_type` values from dispatch records that pass `predicate` (used to scope "since last commit" / "since the API-edit marker" / "this session").
- `lastUserCommitMarker(records)` -> a timestamp/index boundary so "ran *after* the relevant event" is checkable, not just "ran at some point in history."

Residual gap stated once, up front: transcript inspection proves an agent of a given `subagent_type` was **dispatched**, not that it **passed** or that the human-named role (`accessibility-tester`) maps one-to-one to a `subagent_type` string. The five battery agents are invoked as Skills / Task subagents; their exact `subagent_type` strings (or the Skill-invocation record shape for `pr-review-toolkit:review-pr`) must be captured from a real dispatch at implementation time and encoded as the match set. Where a role is a Skill rather than a Task subagent, the verifier matches the Skill-invocation record instead. This is the strongest achievable mechanism short of each agent writing its own signed completion artifact (rejected as heavier than the showcase warrants; see Out of scope). The verifier is therefore a **dispatch gate**, and the spec labels it as such in CLAUDE.md, not a "passed" gate.

### 1. 5-agent-battery verification (replace the rubber stamp)

Convert `pnpm review:stamp` from a blind file-write into a guarded write.

- New `scripts/review-stamp.ts` (replacing the inline `git rev-parse HEAD > .review-passed` in `package.json`). Logic:
  1. Resolve the active transcript. The script runs outside a hook, so `transcript_path` is not on stdin. Resolve the newest `*.jsonl` under `~/.claude/projects/<slug-of-cwd>/` by mtime, where `<slug-of-cwd>` is the cwd path with `/` replaced by `-` (the observed naming: `-Users-erikhenriquealvescunha-Documents-Claude-Projects-erik-portifolio`). State this resolution heuristic and its failure mode explicitly (fail-closed; see Error handling).
  2. Read records since the last commit boundary (`lastUserCommitMarker`). The post-commit hook clears the stamp, so "this push's review" means "agents dispatched since HEAD's commit."
  3. Require the full battery match set present: the `subagent_type` / Skill-record signatures for `pr-review-toolkit:review-pr`, `accessibility-tester`, `security-auditor`, `performance-engineer`, `dependency-manager`.
  4. If all present, `git rev-parse HEAD > .review-passed` and exit 0. Else print the missing agents and exit 1 (do NOT write the stamp). The push then fails at the existing pre-push check (stamp absent).
- The pre-push husky gate is unchanged: it still checks `stamp == HEAD`. The enforcement now lives at the point the stamp is created.
- Optional defense-in-depth: a `PreToolUse` `command` guard branch in `bash-guard.sh` that blocks a raw `... > .review-passed` Bash command (the bypass where an agent skips `pnpm review:stamp` and writes the file directly). `exit 2` with a message pointing to `pnpm review:stamp`. This closes the obvious end-run; without it the script-level refusal is bypassable by one Bash redirect.

Residual gap: dispatch-not-pass (above). Also, an agent could dispatch the five agents, ignore their Critical findings, and still stamp. WS4 does not solve "findings were addressed" mechanically (that needs each agent to emit a structured findings artifact and a resolution ledger, which is the rejected meta-framework). CLAUDE.md is reworded to claim exactly what is enforced: "the stamp is refused unless all five agents were dispatched this review cycle," not "unless all findings were fixed."

### 2. API-edit security gate (PostToolUse marker + pre-push block)

Two-part, because a `PostToolUse` hook cannot block a future push by itself, and the relevant moment to enforce is the push.

- **Marker on edit.** New `.claude/hooks/api-edit-marker.sh`, wired as a second `PostToolUse` `command` hook under the existing `matcher: "Edit|Write"` array (alongside the section-order and css-token guards). It reads `tool_input.file_path` (same extraction as the existing guards) and, if the path matches `app/api/`, `lib/rate-limit.ts`, or `proxy.ts`, appends the edited path plus current HEAD SHA to `.claude/.api-edit-pending` (a gitignored marker file). `exit 0` always (a PostToolUse marker does not block; it records).
- **Block on push.** New branch in `bash-guard.sh` (or a dedicated `.claude/hooks/api-security-push-guard.sh` invoked from the same `PreToolUse` `Bash` matcher). On a `git push` command, if `.claude/.api-edit-pending` is non-empty, read the transcript (`transcript_path` from stdin) and check whether `security-auditor` was dispatched *after* the most recent marker entry. If yes, clear the marker and `exit 0`. If no, `exit 2` with a message naming the pending API files and instructing the user to run `security-auditor`.
- Clearing the marker on a verified audit prevents a stale marker from blocking forever. The marker is also cleared by `scripts/review-stamp.ts` when it confirms `security-auditor` ran (the battery includes it), so the two gates do not double-block.

Residual gap: same dispatch-not-pass limitation. Also, the marker file is local and gitignored, so a fresh clone has no pending markers (correct: a clone has not edited the API surface in this session). The gate is session-scoped, which matches the intent (enforce within the working session, not retroactively across history).

### 3. architect-before-writing-plans gate (PreToolUse on the Skill tool)

CLAUDE.md line 240 requires `architect-reviewer` to return `GATE_RESULT: PASS` before `superpowers:writing-plans`.

- New `.claude/hooks/architect-gate.sh`, wired as a `PreToolUse` `command` hook with `matcher: "Skill"` (a new matcher entry; the current settings only match `Bash` on PreToolUse).
- The hook reads the tool input JSON, extracts the skill name (the `Skill` tool input carries the skill identifier; the exact field, `tool_input.skill` vs `tool_input.command`, is confirmed against a live `Skill` invocation at implementation time, since this repo has no existing `Skill`-matcher hook to copy from). If the skill is not `superpowers:writing-plans`, `exit 0`.
- If it is `writing-plans`: read the transcript and check for an `architect-reviewer` dispatch whose result content contains `GATE_RESULT: PASS` in this session. `GATE_RESULT: PASS` is the contract string already required by CLAUDE.md line 240, so this keys on an existing, intentional sentinel (not a brittle paraphrase). If found, `exit 0`. Else `exit 2` with a message instructing the user to dispatch `architect-reviewer` first.

Residual gap: the verifier checks that an `architect-reviewer` dispatch emitted `GATE_RESULT: PASS` somewhere in the transcript text. Pinning the PASS to the *same spec* under review is not robust via transcript text alone (the spec identity is not a structured field). The gate enforces "architect ran and passed this session," not "architect passed *this exact spec*." Stated in CLAUDE.md. Tightening would require `architect-reviewer` to emit a spec-scoped artifact (deferred; same meta-framework boundary).

Confirmation uncertainty to resolve at implementation: whether `PreToolUse` with `matcher: "Skill"` fires for Skill-tool invocations the same way it fires for `Bash`. This repo only demonstrates the `Bash` matcher live. The implementer MUST prove the `Skill` matcher fires and that `exit 2` blocks the skill (live test, per the project rule) before relying on it. If `PreToolUse` does not intercept `Skill`, fall back to a `command` guard that blocks the Bash/Skill path actually used to launch planning, or downgrade the claim to "convention" with the failing-to-intercept reason recorded. No claim outlives its enforcement.

### 4. gates:runtime in pre-push for non-docs changes

- Edit `.husky/pre-push` to, after the stamp check and `pnpm verify`, compute the push file set and run `pnpm gates:runtime --skip-build` (build already runs in `verify`/CI context) when any changed file is outside the docs-only allowlist (`*.md`, `content/`, `docs/`, config files with no runtime effect, per CLAUDE.md line 184).
- The push range is computed from the git stdin pre-push protocol (local/remote SHA pairs on stdin) or, if unavailable, `git diff --name-only @{u}..HEAD` with a fallback to `origin/main..HEAD`. State the fallback explicitly.
- Docs-only pushes skip `gates:runtime` (matches the CLAUDE.md exception) but still run `pnpm verify`.
- Escape hatch for CI and emergencies: honor a `SKIP_RUNTIME_GATES=1` env var, logged loudly, so the rule is overridable deliberately, not silently. (CI itself runs the runtime gates as separate jobs; the husky hook is the local pre-push net.)

Residual gap: `gates:runtime` is slow (build + dual LHCI + axe + E2E). Running it in every non-docs pre-push adds minutes to the local loop. This is real friction (Risks). The `--skip-build` reuse and the docs-only skip mitigate it; the escape hatch bounds the worst case.

### CLAUDE.md reconciliation (same PR)

Every claim above is reworded to cite its artifact and to state the dispatch-not-pass boundary honestly:

- Line 183 (5-agent battery): "`pnpm review:stamp` refuses to write `.review-passed` unless this review cycle's transcript shows all five agents **dispatched** (`scripts/review-stamp.ts`). It does not verify findings were fixed; that remains your responsibility."
- Lines 59-60 / Ch.9 (security-auditor on API edits): cite `.claude/hooks/api-edit-marker.sh` + the push guard; note it blocks the next `git push`, dispatch-scoped.
- Line 240 (architect before writing-plans): cite `.claude/hooks/architect-gate.sh`; note it enforces a session-scoped `GATE_RESULT: PASS`, not per-spec identity.
- Line 184 (gates:runtime): cite `.husky/pre-push`; note the docs-only skip and the `SKIP_RUNTIME_GATES` escape hatch.
- Any rule that WS4 cannot back with an artifact (e.g. "fix all Critical/Important findings") is explicitly labeled **convention** in place, so the prose stops over-claiming.

## Architecture

### New files

| Path | Purpose | Wiring | Block path |
|---|---|---|---|
| `scripts/review-stamp.ts` | Guarded stamp write; refuses unless 5 agents dispatched this cycle | `package.json` `review:stamp` -> `tsx scripts/review-stamp.ts` | exit 1, no stamp written (push fails at pre-push) |
| `scripts/lib/transcript.mjs` | Shared transcript reader + agent-dispatch detection | imported by review-stamp.ts and the hooks | N/A (library) |
| `.claude/hooks/api-edit-marker.sh` | Records pending API-surface edits to a marker file | `PostToolUse` `matcher: "Edit|Write"`, appended to existing array | exit 0 (record only) |
| `.claude/hooks/api-security-push-guard.sh` | Blocks `git push` while an unaudited API edit is pending | `PreToolUse` `matcher: "Bash"`, appended to existing array (or a branch in `bash-guard.sh`) | exit 2 |
| `.claude/hooks/architect-gate.sh` | Blocks `writing-plans` skill unless architect returned PASS | `PreToolUse` `matcher: "Skill"` (new matcher) | exit 2 |
| `.claude/.api-edit-pending` | Gitignored session marker for pending API edits | written/cleared by the API hooks + review-stamp | N/A (state) |

### Modified files

| Path | Change |
|---|---|
| `.claude/settings.json` | Add `api-edit-marker.sh` to the `PostToolUse` `Edit|Write` hooks array; add `api-security-push-guard.sh` (or rely on a `bash-guard.sh` branch) to the `PreToolUse` `Bash` array; add a new `PreToolUse` `matcher: "Skill"` entry for `architect-gate.sh` |
| `.claude/hooks/bash-guard.sh` | Optional: add a `... > .review-passed` raw-write block branch (exit 2) to close the stamp-bypass |
| `package.json` | `review:stamp` script -> `tsx scripts/review-stamp.ts` |
| `.husky/pre-push` | Add `pnpm gates:runtime --skip-build` for non-docs push ranges; honor `SKIP_RUNTIME_GATES` |
| `.gitignore` | Add `.claude/.api-edit-pending` |
| `CLAUDE.md` | Reword lines 33, 59-60, 132, 183, 184, 240 to cite artifacts; label residual advisory rules "convention" |
| `STANDARDS.md` Ch.9 | Reconcile the `security-auditor`-on-API-edit claim to cite the marker + push guard |

## Error handling and failure modes

Per-hook fail-open vs fail-closed, justified:

- **review-stamp.ts: fail-closed.** If the transcript cannot be located (no `*.jsonl` under the resolved project dir, ambiguous newest file, parse failure), refuse to write the stamp and print why. A stamp is a positive safety assertion; absence of evidence must not become a green light. The cost of fail-closed is a false block when the heuristic misresolves the transcript; the user can re-run after confirming the session, and an explicit `REVIEW_STAMP_TRANSCRIPT=<path>` override is provided for the rare misresolve. Fail-open here would silently restore the rubber stamp this workstream exists to kill.
- **api-security-push-guard.sh: fail-closed on a present marker, fail-open on a missing transcript only when no marker exists.** If `.claude/.api-edit-pending` is empty, `exit 0` (nothing pending, no API edit this session). If the marker is non-empty but `transcript_path` is missing or unreadable, `exit 2` (a pending API edit with unverifiable audit must block, not pass). This bounds the blast radius: the guard is inert until an API file is actually edited, then strict.
- **architect-gate.sh: fail-open on a non-writing-plans skill, fail-closed on writing-plans with no PASS evidence.** Any skill other than `writing-plans` passes immediately (the gate must not tax unrelated skill use). For `writing-plans`, a missing/unreadable transcript blocks (`exit 2`), because the gate's entire job is to require prior architect PASS and it cannot confirm it.
- **api-edit-marker.sh: fail-open (record best-effort).** A PostToolUse recorder that errors must never block the edit (`exit 0` always). If it fails to append the marker, the worst case is a missed block at push, which degrades to the prior honor-system state, not a broken edit loop. The push guard plus the review-stamp battery (which includes `security-auditor`) provide a second net.

Daily-loop friction is itself a failure mode to design against:

- **False blocks erode trust and invite bypass.** If a gate blocks when it should not (transcript misresolve, `subagent_type` string drift after a Claude Code update), the user will reach for `--no-verify` or edit the stamp by hand, defeating the gate. Mitigations: the explicit override envs (`REVIEW_STAMP_TRANSCRIPT`, `SKIP_RUNTIME_GATES`), loud logging on every block with the exact missing condition, and the implementation-time requirement to capture the real `subagent_type` strings rather than guessing them.
- **Hook cannot find the transcript.** Handled by fail-closed/fail-open per hook above; the resolution heuristic (newest JSONL by mtime under the cwd-derived slug) is documented and overridable.

## Test strategy

Every gate is proven by a LIVE block attempt (the project rule: a printed `[BLOCKED]` message is not proof; the tool must actually be stopped). For each gate, a documented manual procedure plus, where the logic is in TypeScript/JS, a unit test of the pure decision function.

1. **review-stamp refusal.** Unit-test `scripts/review-stamp.ts`'s decision function against synthetic transcript fixtures: (a) all 5 agents dispatched -> writes stamp; (b) 4 of 5 -> refuses, names the missing one; (c) unreadable transcript -> refuses (fail-closed). Live: in a session that dispatched no reviewers, run `pnpm review:stamp`, confirm `.review-passed` is NOT created and `git push` is then blocked by pre-push (observe the push abort, not the script's message).
2. **API security push guard (PreToolUse exit 2 actually stops the tool).** Live procedure: edit `lib/rate-limit.ts` (triggers the marker), then attempt `git push` via the Bash tool WITHOUT dispatching `security-auditor`. Confirm the Bash tool call is stopped (the push does not run, observable: no network push, remote unchanged). This proves `exit 2` blocked, distinct from a warn that would let the push proceed. Then dispatch `security-auditor`, retry, confirm the push proceeds and the marker is cleared. Contrast test: change the guard to `exit 1` temporarily and confirm the push DOES run (demonstrating the exit-2-vs-exit-1 distinction the project rule is built on), then revert.
3. **architect-before-writing-plans gate.** Live: invoke `superpowers:writing-plans` via the Skill tool in a session with no `architect-reviewer` `GATE_RESULT: PASS` -> confirm the Skill invocation is blocked (the skill does not start). Then dispatch `architect-reviewer` to PASS, retry, confirm the skill runs. First verify the `PreToolUse` `Skill` matcher fires at all (block a known skill, observe it stopped) before trusting the gate.
4. **gates:runtime in pre-push.** Live: stage a non-docs change, push, confirm `pnpm gates:runtime` runs and a forced gate failure aborts the push. Stage a docs-only change (`*.md`), push, confirm `gates:runtime` is skipped but `pnpm verify` still runs. Confirm `SKIP_RUNTIME_GATES=1` bypasses with a loud log.
5. **Transcript library.** Unit-test `scripts/lib/transcript.mjs`: tolerant parsing of malformed lines, `agentsDispatchedSince` boundary correctness, `subagent_type` extraction from a captured real transcript fixture.

Across all four gates, the acceptance bar is the *observed stop*, captured in the PR body as the evidence the parent program requires for WS4 ("live hook-block verification").

## Acceptance criteria

- Each of the four gates blocks LIVE, verified by a real attempt that observes the tool/push/skill stopped (not by the printed message): (1) review-stamp refuses and the push fails when fewer than five agents were dispatched; (2) `git push` is stopped while an unaudited API edit is pending; (3) `writing-plans` is stopped without a prior architect PASS; (4) a non-docs push runs `gates:runtime` and aborts on failure.
- The exit-2-vs-exit-1 distinction is demonstrated for at least one PreToolUse block (the contrast test in §2), proving the guards block rather than warn.
- `.claude/settings.json` wires every new hook at the correct event/matcher; `package.json` points `review:stamp` at the guarded script.
- CLAUDE.md gate-claim language matches enforced reality: every "hard gate" line cites its backing artifact and its dispatch-not-pass boundary; every rule WS4 cannot enforce is labeled "convention." STANDARDS.md Ch.9 reconciled.
- `pnpm ci:local` passes (unit tests for the decision functions + transcript library included). The full 5-agent review battery and `pnpm ready-for-pr` run before push, per program protocol.

## Out of scope

- **New subagents.** The parent program rejected adding subagents beyond the existing six; the gap is enforcement that they ran, which WS4 addresses without new agents.
- **A meta-enforcement framework** where every agent emits a signed, structured completion + findings artifact and a resolution ledger gates the merge. This would close the dispatch-not-pass gap fully, but it is disproportionate to a single-endpoint reference repo and was rejected in the parent program as cargo-cult over-building. WS6's `check-doc-drift.mjs` is the deliberately scoped, lightweight cousin aimed at the highest-drift artifact instead.
- **Verifying findings were addressed** (only that agents were dispatched). Stated as a residual gap, not silently claimed.
- **`agent` / `prompt` hook-type blocking as the load-bearing mechanism.** Adopted only if its block behavior is proven live at implementation time; otherwise the `command`-plus-transcript mechanism stands and the structured `subagent_type` keying satisfies the "sophisticated, not brittle grep" intent.
- **CSP, env, AI, eval, observability, doc-drift work** (WS0, WS1, WS2, WS3, WS5, WS6) and the CLAUDE.md *procedure extraction* (WS7).

## Risks and open questions

- **Daily-loop friction is a real, recurring cost.** Three of the four gates touch the push/plan/edit hot path. `gates:runtime` in pre-push is the heaviest. If friction is too high, the rational user response is to bypass (`--no-verify`, manual stamp edits), which silently re-opens the gap. This is the dominant risk. Mitigations: `--skip-build` reuse, docs-only skip, explicit logged escape hatches, and keeping the verifiers fast (transcript read is local file I/O, sub-second). Open question: is `gates:runtime` on *every* non-docs pre-push the right cost, or should it gate only at PR-open (`ready-for-pr` already runs it)? Lean: keep it in pre-push with the escape hatch, because PR-open is too late for direct-to-main pushes, which this repo allows.
- **Agent-type / prompt-type hook latency and reliability.** If an `agent`-type semantic verifier is adopted, it adds an LLM round-trip to a `PreToolUse` event, taxing every matched tool call with model latency and nondeterminism. The `command`-plus-transcript design avoids this; the latency risk is the reason `agent`-type is enrichment, not the spine.
- **Reliability of transcript inspection.** The `subagent_type` JSON key is stable today (observed live), but the exact strings for the battery agents, the Skill-invocation record shape for `pr-review-toolkit:review-pr`, the `Skill` tool-input field name, and whether `PreToolUse` intercepts `Skill` at all are NOT all directly observable from the current repo and must be confirmed live at implementation. A Claude Code update could rename `subagent_type` or change the JSONL schema, silently breaking the verifiers (they would fail-closed and over-block, which is the safe direction, but noisy). Open question: pin a transcript-schema fixture test that fails loudly if the structure drifts, so a Claude Code upgrade surfaces the break in CI rather than mid-loop.
- **Transcript resolution outside a hook** (`review-stamp.ts` has no `transcript_path` on stdin). The newest-JSONL-by-mtime heuristic can misresolve with parallel sessions in the same project dir (a known hazard in this repo: memory "Worktree when parallel sessions active"). The `REVIEW_STAMP_TRANSCRIPT` override is the safety valve; open question whether to detect ambiguity (two JSONLs touched within N seconds) and force the override rather than guess.

## Coordination note (WS4 / WS7 CLAUDE.md edits)

WS4 and WS7 both edit CLAUDE.md and must not collide. **WS4 lands first (PR 4) and edits gate-*claim language*** (lines 33, 59-60, 132, 183, 184, 240): rewording each claim to cite its enforcing artifact and labeling residual advisory rules "convention." **WS7 lands after (PR 5) and *relocates procedures*** (`pr-merge-gate`, `visual-baseline-regen`, `ai-eval-update`) out of CLAUDE.md into `.claude/skills/`. Sequence guarantees WS4's reworded gate lines are in place before WS7 moves procedure blocks, so WS7 rebases onto WS4's CLAUDE.md and relocates around the already-corrected claims rather than re-editing the same lines. If WS7 must touch any line WS4 reworded, it preserves WS4's artifact citations verbatim and moves only the procedural prose. No behavioral rule is lost across the two PRs; each gate claim that WS4 made real stays real (and cited) when WS7 reorganizes the file.
