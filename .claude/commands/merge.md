Run the full pre-merge gate chain before merging a PR.

Usage: /merge [pr-number]

Steps:
1. Run `pnpm ready-to-merge $ARGUMENTS` — this executes: ci:local + branch-protection check + Copilot review gate + resolved threads check + pr-metrics report
2. If it exits with "[ready-to-merge] OK", run: `gh pr merge $ARGUMENTS --squash --delete-branch`
3. If any gate fails, fix the underlying issue — never bypass the gate

Note: The bash-guard hook will block a direct `gh pr merge` call. Always go through `pnpm ready-to-merge` first.
