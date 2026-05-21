# 2026 Modernization Program — Session Handoff

> Working handoff for resuming the program in a fresh session. Delete when the program completes.

## What this is

Executing a **4-phase "2026 modernization program"** for this Next.js 16 portfolio, via the
`superpowers:subagent-driven-development` skill (dispatch a fresh implementer per plan-task →
spec-compliance review → code-quality review → fix loop; each phase ships as one PR off `main`).

- **Spec:** `docs/superpowers/specs/2026-05-21-2026-modernization-program-design.md` (architect-reviewer `GATE_RESULT: PASS`)
- **Plan:** `docs/superpowers/plans/2026-05-21-2026-modernization-program.md` — the authoritative task list. Read it.

## Phase progress

| Phase | Status |
|---|---|
| **P1 — AI for 2026** (AI Gateway migration, eval suite, RSC metrics panel, agent.json + MCP) | ✅ Implemented & reviewed — **PR #34 open, merge gate PASSED, awaiting merge** |
| **P2 — Architecture modernization** (Next 16 PPR rework, single DOM tree, component polish) | ⬜ Not started |
| **P3 — CI / tooling / security hardening** | ⬜ Not started |
| **P4 — Accessibility & documentation** | ⬜ Not started |

## IMMEDIATE NEXT ACTION

**Merge PR #34**, then start Phase 2:

```
pnpm ready-to-merge -- 34      # already run — returned "OK — safe to gh pr merge" (4 documented self-resolve warnings)
gh pr merge 34 --squash --delete-branch
git checkout main && git pull --ff-only origin main
```

Then begin **Phase 2** per the plan: create branch `feat/p2-architecture` off the freshly-merged
`main`, and dispatch **Task 2.1 — the PPR spike** (investigation only: verify the current Next 16
`cacheComponents` / PPR / `'use cache'` API form via Context7 before any rework code).

## Branch / git state

- `feat/p1-ai-2026` — Phase 1, HEAD `b26a1f3`, pushed, **PR #34** → `main`.
- `chore/2026-modernization-program` — holds the spec + plan commits, pushed (Phase 1 branched off it, so PR #34 includes the spec/plan).
- `main` — at `f8cfaea` (last merged: PR #33). PR #34 squash-merges onto it.
- 4 old unrelated git stashes (`@{1}`–`@{4}`) from prior sessions — leave them.

## PR #34 post-merge actions (do these after merging)

1. Set **`AI_GATEWAY_API_KEY`** in the Vercel project env, and as a GitHub Actions secret named **`AI_GATEWAY_API_KEY_BUILD`** (the `ai-eval` CI job references it). Until then `ai-eval` passes by skipping cleanly — by design.
2. After ~5 baseline `ai-eval` runs, drop `continue-on-error: true` from the `ai-eval` job in `.github/workflows/ci.yml` and add it to branch-protection required checks.

## Phase 1 — what shipped (PR #34, for context)

8 implementation commits + 2 spec/plan commits + 1 inherited `fix(ci)` commit. Tasks 1.1–1.6:
- **1.1 spike:** AI Gateway exposes the cache-token breakdown (`providerMetadata.anthropic.cacheReadInputTokens` / `cacheCreationInputTokens`) → PATH A.
- **1.2:** `/api/ask` migrated to Vercel AI Gateway (AI SDK v6 `streamText`, `anthropic/claude-haiku-4-5`). Budget cap, cache metric, ephemeral cache, watchdog, injection guard all preserved.
- **1.3:** eval suite — `scripts/ask-eval.ts` + `content/ask-eval-corpus.ts` (37 items) + non-blocking `ai-eval` CI job.
- **1.4:** `components/sections/AiMetricsSection.tsx` — RSC metrics panel (eval pass-rate, jailbreak-resistance, p95 latency, cost/answer).
- **1.5:** `public/.well-known/agent.json` + MCP server at `app/api/[transport]/route.ts` (`/api/mcp`, tools `get_profile` + `ask_erik`); `lib/hiring-profile.ts` is the shared profile source.
- **1.6:** PR #34. Copilot's 4 review findings fixed (`6ccd283`); `ai-eval` `server-only` crash fixed (`b26a1f3`).

## Known issues / gotchas for the next session

- **`e2e-visual` is non-required** (pixel-diff flakiness — see `.github/workflows/ci.yml` header). On PR #34 it fails 3/4 with a **1px height diff** (471→472px) on the contact + hottest-takes section snapshots — a sub-pixel reflow from mounting the new `AiMetricsSection`. The Phase-1 CSS was verified fully `.aimetrics`-scoped (no leak). **Do not chase this** — Phase 2 Task 2.2 regenerates ALL visual baselines (workflow_dispatch `update_visual_baselines: true`), which resolves it. Documented on PR #34.
- The `✗ dep-pinning` lines in `pnpm verify` output are **stdout from `__tests__/scripts/check-dep-pinning.test.ts`** (it runs the pinning script against deliberately-bad fixtures). `verify` exits 0; real `package.json` is correctly pinned. Not a failure.
- The `/dev/tty: Device not configured` line from the husky `prepare-commit-msg` hook in non-interactive shells is benign — commits still land.
- **CLAUDE.md merge gate rule 7:** after EVERY push to a PR branch, post `@copilot /review` (`gh pr comment <pr> --body "@copilot /review"`). Copilot returns its review as a PR **comment** (poll `gh api repos/erikunha/portfolio/issues/<pr>/comments`), not a `reviews[]` object.
- This repo had a transient incident this session: the project folder was moved to the Trash and restored; both branches were pushed to `origin` as a safety net. Work is safe on GitHub.
- P1.2/P1.5 both began with a **spike** because the spec mandates verifying an external API form first. P2.1 (PPR) is likewise a spike — do it before any P2 code.

## How to resume (paste into the new session)

> Read `docs/superpowers/2026-modernization-HANDOFF.md` and `docs/superpowers/plans/2026-05-21-2026-modernization-program.md`, then continue the 2026 modernization program: merge PR #34, then execute Phase 2 via subagent-driven-development.
