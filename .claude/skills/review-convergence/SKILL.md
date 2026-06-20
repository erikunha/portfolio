---
name: review-convergence
description: Use when driving an open PR's claude-review (`/claude-review`, claude[bot]) to green — rebase before every push, reply citing the fix SHA before resolving any thread, verify the pushed SHA, re-request the review. Not for the final merge (see pr-merge-gate).
---

# Review convergence loop

Drive an open PR to mergeable without process gaps. claude-review
(`/claude-review`, claude[bot]) is the sole AI reviewer. Rebase before EVERY
push, no exceptions. The repo owner runs the final `gh pr merge`; AI agents
never do (bash-guard blocks it).

## The loop

0. **Rebase first, always.** `git fetch && git rebase origin/main` before EVERY
   push without exception. Resolve conflicts before continuing.
1. **Push, then verify it landed.** `gh api repos/erikunha/portfolio/pulls/<N> --jq '.head.sha'`
   must equal `git rev-parse HEAD`. If not, re-push before continuing.
2. **Re-request claude-review after every successful push.** Post a
   `/claude-review` comment (`gh pr comment <N> --body /claude-review`). The
   merge gate (`pnpm claude-gate` via `pnpm ready-to-merge`) requires the latest
   `/claude-review` overview verdict to be **Approve** on the current HEAD, so a
   re-review is needed after each push.
3. **Poll CI until green.**
4. **Check for new threads** — claude[bot] inline comments via `gh api graphql`
   `reviewThreads(first:100)` and `gh api .../pulls/<N>/comments`.
5. **Resolve each thread; never resolve silently** (a thread with 1 comment is a
   process failure):
   - **Real finding:** fix, commit, stamp, push, verify SHA, **reply citing the
     fix SHA**, resolve. The reply MUST come after push+verify so it cites the
     actual remote SHA.
   - **Stale / already-fixed:** reply citing the fix SHA and why it is stale,
     then resolve — before the next push.
6. **Wait for claude-review to complete the new review.**
7. **After any push, verify every thread has >= 2 comments.** `comments=1` is a
   silent resolve; add the missing reply (GitHub MCP `add_reply_to_pull_request_comment`,
   not `gh api .../replies`, which 404s on resolved threads).
8. Repeat 4-7 until CI is green AND 0 unresolved threads AND `pnpm ready-to-merge`
   exits OK (it gates on a claude[bot] **Approve** verdict that is non-stale —
   reviewed SHA == HEAD). Only then tell the repo owner to run `gh pr merge`.

## Post-merge transition (automatic, no user prompt)

After confirming merge (`gh pr list --state merged --head <branch> --limit 1`),
`git checkout main && git pull origin main`, then `git branch -d <branch>`. Start
the next planned work item without waiting to be asked.
