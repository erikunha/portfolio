---
name: pr-merge-gate
description: Use when about to merge a pull request — before running `pnpm ready-to-merge`, resolving claude-review/reviewer threads, or rebasing. The bash-guard blocks `gh pr merge` for AI agents (exit 2); the repo owner executes the final merge in an external terminal once all gates pass. Covers the full 9-point pre-merge gate: claude-review Approve requirement, GitHub resolve-thread ground truth, RESOLVE-or-ESCALATE discipline, in-session reviewer findings, self-resolve detection, the `pnpm ready-to-merge` mechanical command, branch-protection invariant, the local Playwright visual check, and the rebase rule with its dependabot and already-reviewed exceptions. Do NOT auto-activate for ordinary pushes — only at merge time.
---

# PR merge gate (9 points)

These are merge-time procedures, not standing rules — they fire only when a PR is
about to be merged. Order matters: **rebase first** (point 9, unless it is a
dependabot branch or the already-reviewed exception applies), THEN run
`pnpm ready-to-merge <pr>` (point 6) so its checks run on the post-rebase HEAD —
running `ready-to-merge` before a rebase wastes the run and a rebase changes HEAD,
invalidating the claude-review/readiness checks. Then work through the rest. The bash-guard blocks `gh pr merge` in agent sessions (exit 2). Once all points pass,
the repo owner executes the final merge in an external terminal or via the GitHub UI.
(The Quick sequence below has the canonical ordering.)

## The 9 points

1. **claude-review Approve requirement (mechanical: `pnpm claude-gate` / `check-claude-approval.ts`); repo owner executes the final merge.** The bash-guard
   blocks `gh pr merge` in agent sessions (exit 2) — the repo owner runs the final
   merge command in an external terminal or via the GitHub UI. `pnpm ready-to-merge <pr>`
   must pass first; it runs `claude-gate`, which requires the latest `/claude-review`
   overview verdict to be **Approve** and non-stale (reviewed SHA == HEAD). If the
   verdict is not Approve or is stale, WAIT — do not self-authorize, do not
   `--admin` override. (Branch protection also mechanically blocks `gh pr merge`
   until the current HEAD is reviewed; a new commit after the Approve re-blocks
   until claude-review re-reviews. Re-request with `gh pr comment <pr> --body /claude-review`
   after any push that fixes a thread; do NOT re-request after self-found fixes —
   CI failures, self-discovered bugs — that burns a review cycle with no new signal.)

2. **GitHub resolve-thread is ground truth.** No merge while any
   `PullRequestReviewThread` is `isResolved: false` (`required_conversation_resolution`
   branch protection). Verify via GraphQL `reviewThreads`, not the timeline.

3. **RESOLVE or ESCALATE every open comment — no third bucket.**
   - RESOLVE = fix commit + a reply citing the commit SHA + behavioral test update.
   - ESCALATE = post the verbatim comment + 2-3 options + a recommendation, then wait
     for the owner's decision.
   - **Every reply to a review thread MUST cite the specific commit SHA that addresses
     it** (`Fixed in <sha>. <reason>`) — a reply with no commit reference is not a
     resolution. For a non-code resolution (PR-description/metadata edit, or a
     "won't fix" with rationale), still reference the commit(s) the decision relates to,
     or state explicitly that no commit was required and why, so the thread is auditable
     from the SHA alone.

4. **In-session reviewer findings count.** Critical/Important findings from
   `pr-review-toolkit`, `code-review`, or `ultrareview` must be fixed (commit) or posted
   as file-line review threads — NOT timeline comments.

5. **Self-resolve is detectable.** `scripts/check-pr-comments.ts` warns when a thread
   was resolved by the PR author/agent. Document the override if it is intentional (an
   agent RESOLVE per point 3 — reply with the fix SHA then resolve — is the standard,
   intended workflow and produces this warning; it is not a violation).

6. **Mechanical command.** `pnpm ready-to-merge <pr>` runs ci:local + branch-protection
   + claude-review Approve verdict (`claude-gate`) + unresolved-thread check + pr-metrics.
   It must pass before `gh pr merge`.

7. **The branch protection rule must stay enabled.** Never disable it to merge.

8. **Local Playwright visual check before merge.** `pnpm dev` + Playwright MCP: inspect
   desktop (1280×720) + mobile (375×812) on all changed sections. CI baselines do not
   catch intent regressions. (This is the check referenced elsewhere as "the pre-merge
   Playwright check.")

9. **Rebase before merge (non-dependabot only).** `git fetch && git rebase origin/main`.
    Skip `dependabot/*` branches. **Exception:** when the user says "merge"/"ship" on a
    PR that already passed the full review battery and CI, the repo owner executes
    `gh pr merge` immediately in an external terminal — no rebase (rebasing would change
    HEAD, invalidate the review stamp, and trigger the pre-push hook needlessly). See
    `DECISIONS.md` for why this is a local gate only.

## Quick sequence

1. `git fetch && git rebase origin/main` (unless dependabot or the already-reviewed
   exception in point 9 applies).
2. `pnpm ready-to-merge <pr>` — must print OK.
3. Confirm 0 unresolved review threads (point 2) and every thread RESOLVED/ESCALATED
   (point 3).
4. Local Playwright visual check on changed sections (point 8).
5. Repo owner runs `gh pr merge <pr> --squash --delete-branch` in an external terminal
   — only after 1-4 pass and claude-review has Approved the current HEAD (point 1). The
   bash-guard blocks direct `gh pr merge` calls in agent sessions (exit 2).

## Related

- `pnpm ready-to-merge` and the `/claude-review` re-request also appear in AGENTS.md's
  AI-agent command table.
- The pre-push review battery + `pnpm review:stamp` (a different, every-push gate) stays
  inline in AGENTS.md — it is not part of this merge-time gate.
