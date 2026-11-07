@AGENTS.md

# Claude Code

- Path-scoped rules in `.claude/rules/` load when a matching file is read: API and server
  boundary, components and CSS, CI and gate configuration.
- Project skills live in `.agents/skills/` (shared with Codex) and are linked into
  `.claude/skills/`. Run `visual-baseline-regen` before a push that may move a screenshot
  baseline, `ai-eval-update` after editing the ask eval inputs, `pr-review-orchestrator` to review a
  PR when asked, and `semgrep` only when asked.
- The `review-worker` agent is read-only (Read, Grep, Glob) and exists for the CI review job.
- Plan before editing more than a few files; use plan mode for anything that touches the API
  boundary, the budgets or the CI workflows.
- Personal settings belong in `CLAUDE.local.md` and `.claude/settings.local.json` (both gitignored).
- `.claude/settings.json` denies broad `git add`, npm and yarn installs and reads of local env files,
  so those rules in AGENTS.md have no exceptions here.
- A PreToolUse hook (`scripts/guard-merge-main.mjs`) fails closed: it blocks any command that carries
  a `gh` merge unless it reads as one `gh pr merge` or `gh api .../pulls/<n>/merge` whose base is not
  `main`, and it checks the GitHub MCP merge tool the same way. Text that only mentions a `gh` merge
  is blocked too.
- A PreToolUse hook (`scripts/guard-test-edits.mjs`) refuses edits to existing test files while a fix
  task is declared: set `FIX_MODE=1` before starting the session, or `touch .claude/fix-mode`
  (gitignored), and unset it or delete the marker to lift it. New test files are always allowed.
- A Stop hook runs `scripts/stop-verify.mjs`: Biome on the changed files, then the typecheck if
  TypeScript changed (about half a second warm; skipped in CI and when it is already continuing a turn).
