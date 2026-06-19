---
name: review-convergence
description: Use when driving an open PR's AI review (claude[bot] via /claude-review, GitHub Copilot, or both) to green — rebase before every push, reply citing the fix SHA before resolving any thread, verify the pushed SHA, re-request the reviewer(s). Not for the final merge (see pr-merge-gate).
---

# Review convergence loop

Drive an open PR to mergeable without process gaps, for whichever AI reviewer(s)
are active — claude[bot] (`/claude-review`), GitHub Copilot, or both. Rebase
before EVERY push, no exceptions. The repo owner runs the final `gh pr merge`;
AI agents never do (bash-guard blocks it).

## The loop

0. **Rebase first, always.** `git fetch && git rebase origin/main` before EVERY
   push without exception. Resolve conflicts before continuing.
1. **Push, then verify it landed.** `gh api repos/erikunha/portfolio/pulls/<N> --jq '.head.sha'`
   must equal `git rev-parse HEAD`. If not, re-push before continuing.
2. **Re-request the reviewer(s) after every successful push** (re-request all active reviewers — Copilot approval is still required by `pnpm ready-to-merge` regardless of whether claude[bot] reviewed):
   - **claude[bot]:** post a `/claude-review` comment (`gh pr comment <N> --body /claude-review`).
   - **Copilot:** REST `POST .../pulls/<N>/requested_reviewers` with
     `copilot-pull-request-reviewer[bot]` (`gh pr edit --add-reviewer` silently
     no-ops for the bot). Verify via REST.
3. **Poll CI until green.**
4. **Check for new threads from any reviewer** — claude[bot] inline comments AND
   Copilot threads — via `gh api graphql` `reviewThreads(first:100)` and
   `gh api .../pulls/<N>/comments`.
5. **Resolve each thread; never resolve silently** (a thread with 1 comment is a
   process failure):
   - **Real finding:** fix, commit, stamp, push, verify SHA, **reply citing the
     fix SHA**, resolve. The reply MUST come after push+verify so it cites the
     actual remote SHA.
   - **Stale / already-fixed:** reply citing the fix SHA and why it is stale,
     then resolve — before the next push.
6. **Wait for the reviewer to complete the new review.**
7. **After any push, verify every thread has >= 2 comments.** `comments=1` is a
   silent resolve; add the missing reply (GitHub MCP `add_reply_to_pull_request_comment`,
   not `gh api .../replies`, which 404s on resolved threads).
8. Repeat 4-7 until CI is green AND 0 unresolved threads AND `pnpm ready-to-merge`
   exits OK (it gates on a **Copilot** approval, so Copilot must review even when
   claude[bot] has already approved). Only then tell the repo owner to run `gh pr merge`.

## Post-merge transition (automatic, no user prompt)

After confirming merge (`gh pr list --state merged --head <branch> --limit 1`),
`git checkout main && git pull origin main`, then `git branch -d <branch>`. Start
the next planned work item without waiting to be asked.
