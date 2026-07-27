---
name: review-convergence
description: Use when driving an open PR's claude-review (`/claude-review`, claude[bot]) to green — rebase before every push, reply citing the fix SHA before resolving any thread, verify the pushed SHA; poll each review run to completion before assessing it; re-request only when no auto-review will otherwise run. Not for the final merge, which is `pnpm ready-to-merge`.
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
2. **Do NOT re-request after a push — the push already triggers a review.**
   The `pull_request` trigger fires on every `synchronize`, and the concurrency
   group is per-PR with `cancel-in-progress: true`, so a `/claude-review` comment
   posted seconds after a push CANCELS the auto-run that was already reviewing
   that SHA. Both runs leave a "Claude Code is working…" comment, the cancelled
   one may already have posted findings against the pre-push SHA, and the cycle
   count doubles. Observed on #229: two `pull_request` runs cancelled, three
   `issue_comment` runs skipped, and a finding posted quoting a comment the push
   had just deleted.

   Re-request ONLY when no review will otherwise run:
   - a completed run posted no parsable verdict
   - the verdict on record is stale against a HEAD no run is currently reviewing

   The workflow-edit exception is REAL and is the one case that needs a comment:
   the trigger is `pull_request`, so GitHub loads the workflow from the PR head
   and the action refuses on any PR editing `.github/workflows/claude-review.yml`.
   No auto verdict can exist there. `pull_request_target` was tried on 2026-07-27
   to remove this case and reverted the same day — upstream's token exchange 401s
   on that event — so do not "fix" it by switching the trigger back.

   `pnpm review:converge` reports which case applies; check it before commenting
   rather than commenting by reflex.

3. **POLL THE RUN TO COMPLETION. Do not report back before it lands.**
   `gh run watch <id> --exit-status`, or poll `gh run list --workflow=claude-review.yml`
   until the run for THIS head is not `in_progress`. A review takes minutes;
   reporting "the review is running" and stopping hands the polling to the human
   and leaves the loop half-executed, which is how threads sit unanswered.

   Then read the OUTCOME, never the job conclusion. A run reports `success` when
   it posted nothing — a skip, a cancellation, or a guard carve-out all look
   identical to a clean review from the outside. The honest checks are: did a
   `claude[bot]` comment appear, and does `pnpm review:converge` say converged.
   Three separate silent-greens on #228-#230 were each first misread as a pass
   because the job was green.

4. **Poll CI until green.**
5. **Check for new threads** — claude[bot] inline comments via `gh api graphql`
   `reviewThreads(first:100)` and `gh api .../pulls/<N>/comments`.
6. **EVERY comment goes in a review THREAD. Never a timeline comment.**
   `gh pr comment <N>` posts an unanchored timeline comment (`#issuecomment-…`) —
   it is attached to no code, cannot be resolved, and never appears in
   `reviewThreads`, so it is invisible to the resolve-thread ground truth in
   `pnpm ready-to-merge`. Do not use it to report a finding, a fix, or a status.
   - **Finding already has a thread** (claude[bot] inline comment): reply in that
     thread — `gh api repos/erikunha/portfolio/pulls/<N>/comments/<comment_id>/replies -f body=…`
     (or GitHub MCP `add_reply_to_pull_request_comment`), then resolve.
   - **Finding has NO thread** (e.g. one your own review battery raised): CREATE a
     thread on the relevant file+line, do not fall back to a timeline comment —
     `gh api repos/erikunha/portfolio/pulls/<N>/comments -f body=… -f commit_id=<HEAD_sha> -f path=<file> -F line=<n>`
     Then reply/resolve it like any other. A self-raised finding that never became a
     thread is an unrecorded finding: it is not in `reviewThreads`, so nothing gates
     on it and the PR's conversation is an incomplete record of what was found.
   - The ONLY acceptable timeline comment is the `/claude-review` re-request trigger
     itself (it is a command, not a comment).

7. **Resolve each thread; never resolve silently** (a thread with 1 comment is a
   process failure):
   - **Real finding:** fix, commit, stamp, push, verify SHA, **reply citing the
     fix SHA**, resolve. The reply MUST come after push+verify so it cites the
     actual remote SHA.
   - **Stale / already-fixed:** reply citing the fix SHA and why it is stale,
     then resolve — before the next push.
8. **Wait for the new review to land — same polling discipline as step 3.**
9. **After any push, verify every thread has >= 2 comments.** `comments=1` is a
   silent resolve; add the missing reply (GitHub MCP `add_reply_to_pull_request_comment`,
   not `gh api .../replies`, which 404s on resolved threads).
10. Repeat 5-9 until CI is green AND 0 unresolved threads AND `pnpm ready-to-merge`
   exits OK (it gates on a claude[bot] **Approve** verdict that is non-stale —
   reviewed SHA == HEAD). Only then tell the repo owner to run `gh pr merge`.

## Post-merge transition (automatic, no user prompt)

After confirming merge (`gh pr list --state merged --head <branch> --limit 1`),
`git checkout main && git pull origin main`, then `git branch -d <branch>`. Start
the next planned work item without waiting to be asked.
