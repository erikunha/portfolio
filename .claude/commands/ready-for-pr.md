Run the pre-PR gate sequence before opening a pull request.

Steps (in order — do not skip):
1. Run `pnpm ready-for-pr` — verifies ci:local, bundle-check, route-js-check and the runtime gates
2. Dispatch the `pr-review-toolkit:code-reviewer` agent against the current branch diff
3. Address all Critical and Important findings with fix commits
4. Then run `gh pr create` with a proper title and body
5. Do NOT comment `/claude-review`. Opening the PR fires `pull_request: opened`,
   which reviews it automatically; a comment seconds later lands in the same
   concurrency group and CANCELS that run. The ONE exception is a PR that edits
   `.github/workflows/claude-review.yml`, where the action refuses and a comment
   is the only path. Poll instead — `pnpm review:converge` reports the state.

Do not run `gh pr create` until steps 1 and 2 are complete. The bash-guard hook will warn if you try.
