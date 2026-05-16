# AI-Dev Setup Remediation — Design Spec

**Date:** 2026-05-16
**Status:** Approved

---

## Scope

Four targeted fixes surfaced by today's full AI-assisted development audit. The prior hardening plan (risk tiers + spec-gate protocol) is already executed. This spec covers the delta: memory corrections, a missing commands section, agent trigger gaps, and undispatched skills.

Approach: single atomic set of changes. One commit per layer (memory, project CLAUDE.md). No new agents, no new skills installed.

---

## Feature 1: Memory Corrections

### 1a — Fix `feedback_commit_message_convention.md`

The memory claims commitlint enforces an enum of seven scopes (`ui`, `content`, `api`, `infra`, `deps`, `a11y`, `perf`). This is false.

`commitlint.config.ts` has `'scope-enum': [0]` — the rule is **disabled**. The comment in the file reads: _"Scope is a feature area (shell, hero, css, layout, resume, …) — open set, no enum restriction."_ Recent commits confirm: `ask`, `docs`, `superpowers`, `tokens`, `claude-md` are all valid scopes.

The memory also claims the root commit was corrected to `chore(infra): init`. Git history shows the actual root commit is `feat(chore): init` (SHA `8fc5672`).

**Change:** Rewrite the stale portion of this memory file to reflect:
- Scope is **required** (commitlint warns if empty)
- Scope is an **open set** — feature area, not an enum
- Root commit is `feat(chore): init` per git history

### 1b — `feedback_init_commit_convention.md`

No change needed. This memory is correct: `feat(chore): init` matches git history.

---

## Feature 2: Commands Section in Project CLAUDE.md

Add a `## Commands` section directly after the project header, before `## Operating role`. All commands sourced from `package.json` scripts.

```markdown
## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright E2E (contact + ask paths) |
| `pnpm check` | Biome lint + format check |
| `pnpm check:fix` | Biome auto-fix |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm lhci` | Lighthouse CI locally |
| `pnpm validate-content` | Zod content schema validation |
| `pnpm ci:local` | Full local CI gate (lint + type + test) |
| `pnpm bundle-check` | Bundle size gate check |
```

---

## Feature 3: Agent Dispatch Additions (project CLAUDE.md)

Five trigger gaps to close in the existing dispatch table.

| File(s) | Agent(s) | Rationale |
|---|---|---|
| `middleware.ts` | `security-auditor` + `nextjs-developer` | Edge routing and CSP headers live here; currently invisible to dispatch |
| `next.config.ts` | `nextjs-developer` + `performance-engineer` | Build-level config affects bundle, RSC, and image optimization |
| `scripts/` | `dx-optimizer` | Bundle check and content validation scripts — same category as CI config |
| `.github/workflows/` | `dx-optimizer` | Workflows dir was missing; `.husky/` already covered |
| `biome.json`, `commitlint.config.ts` | `dx-optimizer` | Linting and commit enforcement config |

One cleanup: the `typescript-pro` trigger lists both `content/*.ts` and `content/schemas.ts` — the explicit `schemas.ts` entry is redundant (already matched by the glob) and should be removed.

---

## Feature 4: Skill Dispatch Additions

### 4a — Project CLAUDE.md (new `## Skill dispatch` section)

Add a new `## Skill dispatch` section immediately after the existing `## Project agent dispatch` table. Skills are distinct from agents — they run inline in the main session, not as subagents.

| Trigger | Skill | Rationale |
|---|---|---|
| After editing any file in `components/` or `app/` | `react-best-practices` | React 19 patterns, RSC/client boundary hygiene — currently undispatched |
| After editing `next.config.ts`, `.env.example`, or Vercel config | `vercel:nextjs` | Vercel-specific Next.js config, edge runtime, caching |
| After editing `app/api/` or `middleware.ts` | `vercel:vercel-functions` | Edge function config, Fluid Compute behavior |
| When writing or modifying any test in `__tests__/` or `tests/` | `superpowers:test-driven-development` | Vitest + Playwright both active — TDD discipline currently undispatched |
| Before any UI code review (alongside `ui-ux-tester` dispatch) | `web-design-guidelines` | Strict two-token palette + WCAG constraints need explicit review trigger |

### 4b — Global `~/.claude/CLAUDE.md` (one row addition)

Add to the "Code quality and review" skill dispatch table:

| Trigger | Skill |
|---|---|
| After receiving a code review from a collaborator or agent | `superpowers:receiving-code-review` |

---

## Files Changed

| File | Change |
|---|---|
| `~/.claude/projects/.../memory/feedback_commit_message_convention.md` | Rewrite stale scope-enum and root-commit claims |
| `CLAUDE.md` | Add `## Commands` section; expand agent dispatch table (5 new triggers); remove redundant `typescript-pro` entry; add 5 skill dispatch rows |
| `~/.claude/CLAUDE.md` | Add `superpowers:receiving-code-review` row to "Code quality and review" table |

Note: memory files and global CLAUDE.md are not tracked by this repo's git. Only the project `CLAUDE.md` gets a commit.

---

## Non-Goals

- Adding new agents beyond those already installed
- Installing new skills (all skills referenced already exist in the available skill list)
- Modifying any agent `.md` file (covered by the prior hardening plan)
- Adding more memories beyond the one correction

---

## Assumptions

- `feat(chore): init` is the canonical root commit form, confirmed by `git log` (SHA `8fc5672`)
- `scope-enum` is intentionally disabled; the open-set pattern is the project convention going forward
- All five skills added to project CLAUDE.md (`react-best-practices`, `vercel:nextjs`, `vercel:vercel-functions`, `superpowers:test-driven-development`, `web-design-guidelines`) are confirmed present in the available skill list
- `superpowers:receiving-code-review` is confirmed present in the available skill list
