# AI-Dev Setup Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two stale memory files, add a commands section to project CLAUDE.md, close five agent dispatch trigger gaps, and add six skill dispatch rows across project and global CLAUDE.md.

**Architecture:** Three-layer change — memory files (not git-tracked), project CLAUDE.md (git-tracked, one commit), global CLAUDE.md (not git-tracked). No code touched, no agents modified.

**Tech Stack:** markdown, git, Read + Edit tools

---

## File map

| File | Operation | Git-tracked? |
|---|---|---|
| `~/.claude/projects/-Users-erikhenriquealvescunha-Documents-Claude-Projects-erik-portifolio/memory/feedback_commit_message_convention.md` | Modify — rewrite stale scope-enum and root-commit claims | No |
| `CLAUDE.md` | Modify — add Commands section, fix agent dispatch, add Skill dispatch section | Yes |
| `~/.claude/CLAUDE.md` | Modify — add `superpowers:receiving-code-review` row | No |

---

## Task 1 — Fix stale memory: commit scope convention

**Files:**
- Modify: `~/.claude/projects/-Users-erikhenriquealvescunha-Documents-Claude-Projects-erik-portifolio/memory/feedback_commit_message_convention.md`

- [ ] **Step 1: Verify current stale content**

```bash
grep -n "scope-enum\|chore(infra)\|Allowed scopes" \
  ~/.claude/projects/-Users-erikhenriquealvescunha-Documents-Claude-Projects-erik-portifolio/memory/feedback_commit_message_convention.md
```

Expected: lines referencing `Allowed scopes (enforced by commitlint)` and `chore(infra): init` — confirming the stale claims are present.

- [ ] **Step 2: Apply the correction**

Use the Edit tool to replace this exact block:

**Old:**
```
Use `type(scope): description` where **scope is always required** — no scopeless commits, ever.

Allowed scopes (enforced by commitlint): `ui`, `content`, `api`, `infra`, `deps`, `a11y`, `perf`

**Why:** Scope identifies which layer of the portfolio changed. commitlint rejects unknown scopes and warns on missing scope. The root commit mistake (`chore: init` without scope) was corrected to `chore(infra): init`.

**How to apply:** Pick the scope from the layer being changed. `infra` covers tooling, CI, git hooks, config. `ui` covers components and styles. `content` covers content/*.ts files. `api` covers route handlers.

Correct:
- `chore(infra): init` (root commit)
- `feat(ui): add mobile dock component`
- `feat(content): update now section data`
- `fix(api): handle contact rate limit edge case`
- `chore(infra): add husky commit-msg hook`
- `chore(deps): bump next to 15.3`

Wrong:
- `chore: init` (missing scope)
- `feat: add mobile components` (missing scope)
- `chore(init): bootstrap` (init is not a valid scope)
- `Create mobile-appbar component (Task 6)` (no type, no scope)
```

**New:**
```
Use `type(scope): description` where **scope is always required** — no scopeless commits, ever.

Scope is an **open set** — any feature area is valid (`ask`, `tokens`, `claude-md`, `shell`, `hero`, `css`, `layout`, `resume`, …). `commitlint.config.ts` has `scope-enum: [0]` (disabled). The only enforced rule is scope must be non-empty (`scope-empty: [1, 'never']`).

**Why:** Scope identifies which layer changed. commitlint warns on missing scope but does not restrict which scope you use. The earlier claim of a fixed enum was wrong — confirmed by reading `commitlint.config.ts` and recent commit history.

**How to apply:** Pick the feature area being changed. Conventions: `infra` for tooling/CI/git-hooks/config, `ui` for components and styles, `content` for `content/*.ts` files, `api` for route handlers — but these are guidelines, not an enum.

Correct:
- `feat(chore): init` (root commit — SHA 8fc5672)
- `feat(ui): add mobile dock component`
- `feat(content): update now section data`
- `fix(api): handle contact rate limit edge case`
- `fix(ask): reformat phone number`
- `feat(tokens): normalize font-size`
- `chore(deps): bump next to 15.3`

Wrong:
- `chore: init` (missing scope)
- `feat: add mobile components` (missing scope)
- `Create mobile-appbar component (Task 6)` (no type, no scope)
```

- [ ] **Step 3: Verify the correction was applied**

```bash
grep -n "open set\|8fc5672\|scope-enum" \
  ~/.claude/projects/-Users-erikhenriquealvescunha-Documents-Claude-Projects-erik-portifolio/memory/feedback_commit_message_convention.md
```

Expected: three lines — one matching `open set`, one matching `8fc5672`, one matching `scope-enum`.

```bash
grep -n "chore(infra): init\|Allowed scopes (enforced" \
  ~/.claude/projects/-Users-erikhenriquealvescunha-Documents-Claude-Projects-erik-portifolio/memory/feedback_commit_message_convention.md
```

Expected: no output — stale claims are gone.

---

## Task 2 — Add Commands section to project CLAUDE.md

**Files:**
- Modify: `CLAUDE.md:7-9`

- [ ] **Step 1: Verify insertion point**

```bash
grep -n "## Operating role\|## Project" CLAUDE.md
```

Expected:
```
5:## Project
9:## Operating role
```

- [ ] **Step 2: Insert Commands section**

Use the Edit tool to replace this exact block (lines 7-9):

**Old:**
```
**erikunha.com.br** — personal portfolio. Hiring artifact for Staff/Principal Frontend + applied-AI roles. Matrix/brutalist terminal aesthetic. Single-page composition with ~18 sections.

## Operating role
```

**New:**
```
**erikunha.com.br** — personal portfolio. Hiring artifact for Staff/Principal Frontend + applied-AI roles. Matrix/brutalist terminal aesthetic. Single-page composition with ~18 sections.

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

## Operating role
```

- [ ] **Step 3: Verify the section was inserted**

```bash
grep -n "pnpm dev\|pnpm ci:local\|## Commands" CLAUDE.md
```

Expected: three matching lines — `## Commands`, `pnpm dev`, and `pnpm ci:local`.

---

## Task 3 — Fix agent dispatch: remove redundant entry + close trigger gaps

**Files:**
- Modify: `CLAUDE.md` (agent dispatch table)

- [ ] **Step 1: Fix typescript-pro trigger — remove redundant `content/schemas.ts`**

Use the Edit tool:

**Old:**
```
| Type safety | After editing `content/*.ts` or `content/schemas.ts` | `typescript-pro` |
```

**New:**
```
| Type safety | After editing `content/*.ts` | `typescript-pro` |
```

- [ ] **Step 2: Expand DX/Tooling row to cover scripts, workflows, biome, commitlint**

Use the Edit tool:

**Old:**
```
| DX/Tooling | After editing `.husky/`, `ci.yml`, `vitest.config.ts`, `playwright.config.ts` | `dx-optimizer` |
```

**New:**
```
| DX/Tooling | After editing `.husky/`, `ci.yml`, `vitest.config.ts`, `playwright.config.ts`, `.github/workflows/`, `scripts/`, `biome.json`, `commitlint.config.ts` | `dx-optimizer` |
```

- [ ] **Step 3: Add middleware.ts to Security row and add Edge/routing row**

Use the Edit tool:

**Old:**
```
| Security | After editing `app/api/`, `lib/rate-limit.ts`, or `.env.example` | `security-auditor` |
| Refactoring | When restructuring components or CSS without behavior change | `refactoring-specialist` |
```

**New:**
```
| Security | After editing `app/api/`, `lib/rate-limit.ts`, `.env.example`, or `middleware.ts` | `security-auditor` |
| Edge/routing | After editing `middleware.ts` or `next.config.ts` | `nextjs-developer` + `performance-engineer` |
| Refactoring | When restructuring components or CSS without behavior change | `refactoring-specialist` |
```

- [ ] **Step 4: Verify the dispatch table has all expected rows**

```bash
grep -n "dx-optimizer\|typescript-pro\|Edge/routing\|security-auditor\|middleware" CLAUDE.md
```

Expected output (5 lines):
```
<line>:| Type safety | After editing `content/*.ts` | `typescript-pro` |
<line>:| DX/Tooling | After editing `.husky/`...`commitlint.config.ts` | `dx-optimizer` |
<line>:| Security | After editing `app/api/`...`middleware.ts` | `security-auditor` |
<line>:| Edge/routing | After editing `middleware.ts` or `next.config.ts` | `nextjs-developer` + `performance-engineer` |
```

Confirm `content/schemas.ts` is gone from the typescript-pro line:

```bash
grep "schemas.ts" CLAUDE.md
```

Expected: no output (schemas.ts appears nowhere in the dispatch table).

---

## Task 4 — Add Skill dispatch section to project CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (between agent dispatch table and Stack section)

- [ ] **Step 1: Verify insertion point**

```bash
grep -n "## Stack (locked)" CLAUDE.md
```

Expected: one line, e.g. `52:## Stack (locked)` (line number will shift after Tasks 2-3).

- [ ] **Step 2: Insert Skill dispatch section**

Use the Edit tool:

**Old:**
```
## Stack (locked)
```

**New:**
```
## Skill dispatch

Invoke the named skill inline (not as a subagent) before the described action.

| Trigger | Skill |
|---|---|
| After editing any file in `components/` or `app/` | `react-best-practices` |
| After editing `next.config.ts`, `.env.example`, or Vercel config | `vercel:nextjs` |
| After editing `app/api/` or `middleware.ts` | `vercel:vercel-functions` |
| When writing or modifying any test in `__tests__/` or `tests/` | `superpowers:test-driven-development` |
| Before any UI code review (alongside `ui-ux-tester` dispatch) | `web-design-guidelines` |

## Stack (locked)
```

- [ ] **Step 3: Verify the section was inserted**

```bash
grep -n "## Skill dispatch\|react-best-practices\|vercel:nextjs\|web-design-guidelines" CLAUDE.md
```

Expected: four matching lines — the section header plus three skill names.

---

## Task 5 — Commit project CLAUDE.md changes

**Files:**
- Commit: `CLAUDE.md`

- [ ] **Step 1: Confirm only CLAUDE.md is staged**

```bash
git diff --name-only HEAD
```

Expected: `CLAUDE.md` only.

- [ ] **Step 2: Run full local CI gate**

```bash
pnpm ci:local
```

Expected: exits 0. Biome, tsc, validate-content, vitest all pass. (CLAUDE.md changes do not affect any of these, but always run the gate before committing.)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "feat(claude-md): add commands, close agent dispatch gaps, add skill dispatch"
```

Expected: commit succeeds, hook output shows all checks pass.

- [ ] **Step 4: Verify commit**

```bash
git log --oneline -1
```

Expected: `feat(claude-md): add commands, close agent dispatch gaps, add skill dispatch`

---

## Task 6 — Add receiving-code-review to global CLAUDE.md

**Files:**
- Modify: `~/.claude/CLAUDE.md`

- [ ] **Step 1: Verify the insertion point**

```bash
grep -n "socratic-debate\|receiving-code-review" ~/.claude/CLAUDE.md
```

Expected: one line matching `socratic-debate`, zero lines matching `receiving-code-review`.

- [ ] **Step 2: Add the row**

Use the Edit tool to replace this exact block in `~/.claude/CLAUDE.md`:

**Old:**
```
| Any technical recommendation that isn't obviously correct | `socratic-debate` |
```

**New:**
```
| Any technical recommendation that isn't obviously correct | `socratic-debate` |
| After receiving a code review from a collaborator or agent | `superpowers:receiving-code-review` |
```

- [ ] **Step 3: Verify the row was added**

```bash
grep -n "receiving-code-review" ~/.claude/CLAUDE.md
```

Expected: one line in the "Code quality and review" table.

---

## Final verification

- [ ] **Memory file is corrected**

```bash
grep "open set\|8fc5672" \
  ~/.claude/projects/-Users-erikhenriquealvescunha-Documents-Claude-Projects-erik-portifolio/memory/feedback_commit_message_convention.md
```

Expected: two matching lines.

- [ ] **Project CLAUDE.md has all new sections**

```bash
grep -c "## Commands\|## Skill dispatch\|Edge/routing\|react-best-practices" CLAUDE.md
```

Expected: `4`

- [ ] **Global CLAUDE.md has receiving-code-review**

```bash
grep -c "receiving-code-review" ~/.claude/CLAUDE.md
```

Expected: `1`

- [ ] **CI passes**

```bash
pnpm ci:local 2>&1 | tail -3
```

Expected: `Tests 54 passed (54)`, exit 0.

---

## Self-review

**Spec coverage:**
- Feature 1 (memory correction): Task 1 covers full rewrite with exact old/new content ✓
- Feature 2 (commands section): Task 2 covers exact insertion with all 11 commands from package.json ✓
- Feature 3 (agent dispatch gaps): Task 3 covers all 5 gaps — redundant entry removed, DX/Tooling expanded, Security + Edge rows updated ✓
- Feature 4a (project skill dispatch): Task 4 covers new section with all 5 skills ✓
- Feature 4b (global skill dispatch): Task 6 covers `superpowers:receiving-code-review` row ✓

**Placeholder scan:** No TBD, no "similar to above". Every step has exact old/new content or exact bash commands with expected output. ✓

**Type consistency:** No code types — all changes are markdown. File paths are consistent across all tasks and match the file map. ✓
