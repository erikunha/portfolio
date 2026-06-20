Run the pre-PR gate sequence before opening a pull request.

Steps (in order — do not skip):
1. Run `pnpm ready-for-pr` — verifies ci:local passes and PR size is not red
2. Invoke the `pr-review-toolkit:review-pr` skill against the current branch diff
3. Address all Critical and Important findings with fix commits
4. Then run `gh pr create` with a proper title and body
5. Run `gh pr comment <pr> --body /claude-review` to request the claude-review

Do not run `gh pr create` until steps 1 and 2 are complete. The bash-guard hook will warn if you try.
