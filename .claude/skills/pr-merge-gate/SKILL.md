---
name: pr-merge-gate
description: Use when about to merge a pull request — before running `pnpm ready-to-merge`, resolving Copilot/reviewer threads, rebasing, or executing `gh pr merge`. Covers the full 10-point pre-merge gate: Copilot auth requirement, GitHub resolve-thread ground truth, RESOLVE-or-ESCALATE discipline, in-session reviewer findings, self-resolve detection, the `pnpm ready-to-merge` mechanical command, branch-protection invariant, the Copilot re-request loop, the local Playwright visual check, and the rebase rule with its dependabot and already-reviewed exceptions. Do NOT auto-activate for ordinary pushes — only at merge time.
---

# PR merge gate (10 points)

These are merge-time procedures, not standing rules — they fire only when a PR is
about to be merged. Run `pnpm ready-to-merge <pr>` first (point 6); it mechanically
checks most of the gate. Then work through the rest. AI agents must NOT call
`gh pr merge` until every applicable point passes.

## The 10 points

1. **Copilot review required for agent merges.** AI agents may not call `gh pr merge`
   without a Copilot review on the latest HEAD. The repo owner may merge directly.
   Agents: `pnpm ready-to-merge <pr>` must pass; if Copilot is unavailable, WAIT — do
   not self-authorize, do not `--admin` override. (Branch protection mechanically
   blocks `gh pr merge` with "base branch policy prohibits" until Copilot has reviewed
   the current HEAD; a new commit after Copilot's review re-blocks until it re-reviews.)

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
   + Copilot approval + unresolved-thread check + pr-metrics. It must pass before
   `gh pr merge`.

7. **The branch protection rule must stay enabled.** Never disable it to merge.

8. **Copilot review loop — do NOT post any comment on PR open.** Copilot auto-reviews on
   open. After any push that fixes a **Copilot thread**:
   - reply to each addressed thread:
     `gh api repos/{owner}/{repo}/pulls/<pr>/comments/<databaseId>/replies -f body="Fixed in <sha>. <reason>"`
   - then re-request: `gh pr edit <pr> --add-reviewer copilot-pull-request-reviewer`
     (the raw REST API rejects Copilot as a reviewer; `gh pr edit` works).
   Do NOT re-request after self-found fixes (CI failures, self-discovered bugs) — that
   burns a review cycle with no new signal. Never post a PR-level timeline comment.

9. **Local Playwright visual check before merge.** `pnpm dev` + Playwright MCP: inspect
   desktop (1280×720) + mobile (375×812) on all changed sections. CI baselines do not
   catch intent regressions. (This is the check referenced elsewhere as "the pre-merge
   Playwright check.")

10. **Rebase before merge (non-dependabot only).** `git fetch && git rebase origin/main`.
    Skip `dependabot/*` branches. **Exception:** when the user says "merge"/"ship" on a
    PR that already passed the full review battery and CI, execute `gh pr merge`
    immediately, no rebase — rebasing would change HEAD, invalidate the review stamp, and
    trigger the pre-push hook needlessly. See `DECISIONS.md` for why this is a local gate
    only.

## Quick sequence

1. `git fetch && git rebase origin/main` (unless dependabot or the already-reviewed
   exception in point 10 applies).
2. `pnpm ready-to-merge <pr>` — must print OK.
3. Confirm 0 unresolved review threads (point 2) and every thread RESOLVED/ESCALATED
   (point 3).
4. Local Playwright visual check on changed sections (point 9).
5. `gh pr merge <pr> --squash --delete-branch` — only after 1-4 pass and Copilot has
   reviewed the current HEAD (point 1).

## Related

- `pnpm ready-to-merge` and the Copilot re-request command also appear in CLAUDE.md's
  AI-agent command table.
- The pre-push review battery + `pnpm review:stamp` (a different, every-push gate) stays
  inline in CLAUDE.md — it is not part of this merge-time gate.
