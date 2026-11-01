# AGENTS.md

Instructions for any coding agent working in this repository. `CLAUDE.md` holds the full project
context (stack, budgets, aesthetic, working agreement); read it first. This file is the short
version for agents that do not load `CLAUDE.md`.

## Validate every change

| Step                                                                     | Command                                       |
| ------------------------------------------------------------------------ | --------------------------------------------- |
| Full local gate (lint, types, content, naming, harness size, unit tests) | `pnpm ci:local`                               |
| Lint and format                                                          | `pnpm check` (fix with `pnpm check:fix`)      |
| Types                                                                    | `pnpm typecheck`                              |
| Unit tests                                                               | `pnpm test`                                   |
| Build                                                                    | `pnpm build`                                  |
| Bundle budgets                                                           | `pnpm bundle-check` and `pnpm route-js-check` |
| End to end, a11y, visual                                                 | `pnpm test:e2e` against a production build    |

A change is done when `pnpm ci:local` passes and the e2e specs for every touched route pass.

## Rules

- Follow every numbered rule in `docs/handbook/lessons.md`.
- Review diffs with `docs/handbook/review-standard.md` as the prompt (the claude-review bot uses `.github/claude-review-prompt.md`).
- Content lives in `content/*.ts`, tokens in `app/css/theme.css`, client islands are
  `*.client.tsx`. No magic values, no prose comments in source, no em or en dash.
- Stage specific files (`git add <file>`), never `git add .`.
