Run the full pre-merge gate chain before merging a PR.

Usage: /merge [pr-number]

Steps:
1. Rebase: `git fetch && git rebase origin/main` (skip for dependabot branches or when the already-reviewed exception applies — see `.claude/skills/pr-merge-gate` point 9)
2. Run `pnpm ready-to-merge $ARGUMENTS` — this executes: ci:local + branch-protection check + claude-review gate + resolved threads check + pr-metrics report
3. If it exits with "[ready-to-merge] OK", the **repo owner** runs: `gh pr merge $ARGUMENTS --squash --delete-branch` in an external terminal (the bash-guard blocks direct `gh pr merge` calls in agent sessions — exit 2)
4. If any gate fails, fix the underlying issue — never bypass the gate
