---
name: copilot-convergence
description: Use when converging an open PR's review cycle to green — pushing fixes to a PR, re-requesting Copilot, resolving review threads, or deciding whether a PR is ready to merge. Covers the rebase-before-every-push rule, push-SHA verification, the reply-before-resolve discipline, the PR-comment gate timing race, and the automatic post-merge transition. Do NOT use for the final merge itself (that is pr-merge-gate) or for the pre-push review battery.
---

# Copilot convergence loop

Drive an open PR to "mergeable" without process gaps. Rebase before EVERY push,
no exceptions. The repo owner runs the final `gh pr merge`; AI agents never do
(bash-guard blocks it).

## The loop

0. **Rebase first, always.** `git fetch && git rebase origin/main` before EVERY
   push without exception: at loop start, after any sibling PR merges to main,
   and before each fix push. Resolve any conflicts before continuing.
1. **Push, then verify it landed.** After push, confirm the GitHub HEAD matches
   local: `gh api repos/erikunha/portfolio/pulls/<N> --jq '.head.sha'` must equal
   `git rev-parse HEAD`. If not, the push silently failed; re-push before
   continuing.
2. **Re-request Copilot after every successful push.**
   `gh pr edit <N> --add-reviewer copilot-pull-request-reviewer`.
3. **Poll CI until green.**
4. **Check for new Copilot threads.** `gh api graphql` with
   `reviewThreads(first:100)`.
5. **Resolve each thread; never resolve silently** (a thread with 1 comment is a
   process failure):
   - **(a) Real finding:** fix code, commit, stamp, resolve any co-occurring
     stale threads now (per 5b) BEFORE pushing, push, verify SHA, **reply citing
     the fix SHA**, resolve the real-finding thread, re-request Copilot. The
     reply MUST come after push+verify so it cites the actual remote SHA;
     replying before push references a SHA not yet on the remote.
   - **(b) Stale / already-fixed:** reply citing the fix SHA and why it is stale,
     then resolve. This MUST happen before the next push: the PR-comment gate
     runs on every CI trigger and sees whatever threads are open at that moment,
     so an unresolved stale thread fails the gate even when the code is correct.
     Do NOT re-request Copilot until the fix for the real finding is on the remote.
6. **Wait for Copilot to complete the new review.**
7. **After any push, verify every thread has >= 2 comments.** `comments=1` means a
   silent resolve; add the missing reply retroactively via the GitHub MCP
   `add_reply_to_pull_request_comment` tool (NOT `gh api .../replies`, which 404s
   on resolved threads).
8. **If the PR-comment gate failed on a timing race** (threads resolved AFTER the
   CI run started), re-run with `gh run rerun --failed` on the workflow run ID.
   Do NOT push a new commit just to re-trigger CI.
9. Repeat 4-7 until CI is green AND 0 unresolved threads AND `pnpm ready-to-merge`
   exits OK. Only then tell the repo owner to run `gh pr merge`. Never declare
   "ready to merge" before verifying the push landed, CI is green, and Copilot has
   0 new threads after the last re-request.

## Post-merge transition (automatic, no user prompt)

After confirming the PR merged (`gh pr list --state merged --head <branch> --limit 1`),
run `git checkout main && git pull origin main`, then `git branch -d <branch>` to
clean up the stale local branch. Then start the next planned work item without
waiting to be asked.
