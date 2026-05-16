# Spec-Kit Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install 9 marketplace agents with portfolio-specific context blocks, update CLAUDE.md with a full agent dispatch table and spec-gate rule, expand `settings.local.json` skill allowlist, and harden the pre-commit hook.

**Architecture:** Each agent install is a copy-from-marketplace + append-portfolio-context operation. Config changes are isolated edits. No code is compiled — verification is file existence checks and `pnpm ci:local` at the end.

**Tech Stack:** bash, pnpm, Vitest, Biome, TypeScript strict, Husky

---

## File map

| File | Operation |
|---|---|
| `~/.claude/agents/architect-reviewer.md` | Create (copy + append) |
| `~/.claude/agents/nextjs-developer.md` | Create (copy + append) |
| `~/.claude/agents/typescript-pro.md` | Create (copy + append) |
| `~/.claude/agents/test-automator.md` | Create (copy + append) |
| `~/.claude/agents/ui-ux-tester.md` | Create (copy + append) |
| `~/.claude/agents/ai-engineer.md` | Create (copy + append) |
| `~/.claude/agents/seo-specialist.md` | Create (copy + append) |
| `~/.claude/agents/dx-optimizer.md` | Create (copy + append) |
| `~/.claude/agents/dependency-manager.md` | Create (copy + append) |
| `CLAUDE.md` | Modify — add dispatch table section + spec-gate rule |
| `.claude/settings.local.json` | Modify — add 13 skill entries to allow list |
| `.husky/pre-commit` | Modify — replace `pnpm test` with full fast-gate chain |
| `package.json` | Modify — add `ci:local` script |

---

## Task 1 — Install planning + implementation agents

**Files:**
- Create: `~/.claude/agents/architect-reviewer.md`
- Create: `~/.claude/agents/nextjs-developer.md`
- Create: `~/.claude/agents/typescript-pro.md`

- [ ] **Step 1: Copy architect-reviewer from marketplace**

```bash
cp "~/.claude/plugins/marketplaces/voltagent-subagents/categories/04-quality-security/architect-reviewer.md" \
   "~/.claude/agents/architect-reviewer.md"
```

- [ ] **Step 2: Append portfolio context to architect-reviewer**

```bash
cat >> "~/.claude/agents/architect-reviewer.md" << 'EOF'

## Portfolio project context
- Stack: Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4, Vercel edge
- Rendering model: RSC by default; client islands by exception (named *.client.tsx)
- Single-page composition — no per-section routing (see DECISIONS.md)
- Rejected patterns: GraphQL, Cloudflare Workers, multi-region, Sentry, CAPTCHA, separate routes, state management library, MDX, CMS
- Before approving any plan: check against CLAUDE.md "Out of scope" list and DECISIONS.md
- Performance gates are non-negotiable CI constraints: LCP < 1.8s, INP < 200ms, CLS < 0.05, Perf ≥ 95, A11y = 100, SEO = 100
EOF
```

- [ ] **Step 3: Copy nextjs-developer from marketplace**

```bash
cp "~/.claude/plugins/marketplaces/voltagent-subagents/categories/02-language-specialists/nextjs-developer.md" \
   "~/.claude/agents/nextjs-developer.md"
```

- [ ] **Step 4: Append portfolio context to nextjs-developer**

```bash
cat >> "~/.claude/agents/nextjs-developer.md" << 'EOF'

## Portfolio project context
- Next.js 15 with Turbopack dev (`next dev --turbopack`)
- RSC-first: default to server components; add 'use client' only when state/effects/browser APIs required
- Client files must be named *.client.tsx — never add 'use client' to a non-.client file
- Client JS budget: 43KB gzipped total across all islands; per-route: 120KB gzipped
- Existing client islands: InteractiveShell, ContactForm, ToTopButton, MatrixRain, CRTOverlay, StatusBar, Dock, MobileTitleBar, AppShell.client, ErrorBoundary.client
- Performance gates: LCP < 1.8s, INP < 200ms, CLS < 0.05, Lighthouse Perf ≥ 95
- Deployment: Vercel edge, Node 22, pnpm 10
- No per-section routing; single-page composition only
- Matrix dialog loop must use useRef.textContent mutation, NOT per-keystroke useState — Vitest test enforces this
EOF
```

- [ ] **Step 5: Copy typescript-pro from marketplace**

```bash
cp "~/.claude/plugins/marketplaces/voltagent-subagents/categories/02-language-specialists/typescript-pro.md" \
   "~/.claude/agents/typescript-pro.md"
```

- [ ] **Step 6: Append portfolio context to typescript-pro**

```bash
cat >> "~/.claude/agents/typescript-pro.md" << 'EOF'

## Portfolio project context
- TypeScript strict mode enforced; `pnpm tsc --noEmit` is a CI gate
- Content files in `content/*.ts` are typed TS modules validated by Zod at build time
- `content/schemas.ts` holds all Zod schemas; build fails on schema violation
- `zod` is exact-pinned at current version — do not upgrade without deliberate review
- Use `satisfies` operator to validate content objects against schemas without losing inference
- All content must pass `node scripts/validate-content.mjs` before commit
- No `any` — if you find one, fix it; never suppress with `// @ts-ignore`
EOF
```

- [ ] **Step 7: Verify all three agent files exist with portfolio context**

```bash
grep -l "Portfolio project context" \
  "~/.claude/agents/architect-reviewer.md" \
  "~/.claude/agents/nextjs-developer.md" \
  "~/.claude/agents/typescript-pro.md"
```

Expected: all three paths printed.

- [ ] **Step 8: Commit**

```bash
git add -N . 2>/dev/null; git commit -m "feat(agents): install architect-reviewer, nextjs-developer, typescript-pro"
```

Note: agent files live in `~/.claude/agents/` — they are not tracked by this repo's git. Skip the git commit for this task; the files are installed globally. Remove this step.

---

## Task 2 — Install testing + visual agents

**Files:**
- Create: `~/.claude/agents/test-automator.md`
- Create: `~/.claude/agents/ui-ux-tester.md`

- [ ] **Step 1: Copy test-automator from marketplace**

```bash
cp "~/.claude/plugins/marketplaces/voltagent-subagents/categories/04-quality-security/test-automator.md" \
   "~/.claude/agents/test-automator.md"
```

- [ ] **Step 2: Append portfolio context to test-automator**

```bash
cat >> "~/.claude/agents/test-automator.md" << 'EOF'

## Portfolio project context
- Unit tests: Vitest in `__tests__/` — run with `pnpm vitest run`
- E2E tests: Playwright in `tests/e2e/` — run with `pnpm playwright test tests/e2e`
- A11y tests: axe-core + Playwright in `tests/a11y/axe.spec.ts` — run with `pnpm playwright test tests/a11y`
- CI jobs: build-and-gate (unit + a11y) and e2e (separate job, needs build-and-gate to pass first)
- Matrix dialog loop must NOT use per-keystroke useState — existing Vitest test `__tests__/matrix-rain.test.ts` enforces this; do not break it
- Test environment: jsdom for unit tests; Playwright uses Chromium only
- Playwright config: `playwright.config.ts` at project root
- Pre-commit runs vitest only (`pnpm test`); Playwright stays CI-only — do not add Playwright to pre-commit
- Vitest config: `vitest.config.ts` at project root
EOF
```

- [ ] **Step 3: Copy ui-ux-tester from marketplace**

```bash
cp "~/.claude/plugins/marketplaces/voltagent-subagents/categories/04-quality-security/ui-ux-tester.md" \
   "~/.claude/agents/ui-ux-tester.md"
```

- [ ] **Step 4: Append portfolio context to ui-ux-tester**

```bash
cat >> "~/.claude/agents/ui-ux-tester.md" << 'EOF'

## Portfolio project context
- Target URL: http://localhost:3000 (run `pnpm dev` or `pnpm start` first before invoking this agent)
- Chrome MCP is pre-configured in this project — use it for all browser interactions
- Viewports to test: 390×844 (iPhone 15 Pro mobile) and 1440×900 (desktop)
- Aesthetic rules to verify:
  - Background must be #000000 — no off-black or grey variants
  - Text: --signal (#00FF41) for headings/accents only; --fg (#E6FFE6) for all body text
  - Font: JetBrains Mono everywhere except hero headline (Inter 900 / Geist Black)
  - Borders: 1px only, no border-radius > 2px anywhere
  - CRT effects (scanlines, grain, flicker, phosphor shadow) must be OFF under prefers-reduced-motion
- Key sections to audit: Hero boot sequence, InteractiveShell chips, MatrixRain, all 18 content sections
- Report format: structured defect list with screenshot path, severity (critical/major/minor), and fix recommendation
EOF
```

- [ ] **Step 5: Verify both agent files exist with portfolio context**

```bash
grep -l "Portfolio project context" \
  "~/.claude/agents/test-automator.md" \
  "~/.claude/agents/ui-ux-tester.md"
```

Expected: both paths printed.

---

## Task 3 — Install AI + SEO agents

**Files:**
- Create: `~/.claude/agents/ai-engineer.md`
- Create: `~/.claude/agents/seo-specialist.md`

- [ ] **Step 1: Copy ai-engineer from marketplace**

```bash
cp "~/.claude/plugins/marketplaces/voltagent-subagents/categories/05-data-ai/ai-engineer.md" \
   "~/.claude/agents/ai-engineer.md"
```

- [ ] **Step 2: Append portfolio context to ai-engineer**

```bash
cat >> "~/.claude/agents/ai-engineer.md" << 'EOF'

## Portfolio project context
- AI endpoint: `app/api/ask/route.ts`
- SDK: `@anthropic-ai/sdk` (package name in package.json)
- Model: `claude-haiku-4-5-20251001` — upgrade path to Sonnet exists if quality complaints arise
- Prompt caching enabled via `cache_control: { type: 'ephemeral' }` on the system prompt — do not remove this
- Monthly token hard cap: 400K tokens stored in Upstash Redis key `ask:tokens:YYYY-MM`
- Rate limit: `slidingWindow(8, '1 h')` via `@upstash/ratelimit` in `lib/rate-limit.ts`
- Streaming response: custom protocol in `lib/stream-protocol.ts`
- Fail-open on Redis unavailability — never block the user for infrastructure reasons
- Monthly spend hard cap ($50 with 80%/95% alert thresholds): CRITICAL — never disable or weaken
- IP hashed with SHA-256 + DEPLOY_SALT before any storage — no raw IPs persisted
EOF
```

- [ ] **Step 3: Copy seo-specialist from marketplace**

```bash
cp "~/.claude/plugins/marketplaces/voltagent-subagents/categories/07-specialized-domains/seo-specialist.md" \
   "~/.claude/agents/seo-specialist.md"
```

- [ ] **Step 4: Append portfolio context to seo-specialist**

```bash
cat >> "~/.claude/agents/seo-specialist.md" << 'EOF'

## Portfolio project context
- Lighthouse SEO gate: must = 100 — this is a non-negotiable CI gate; never regress it
- OG image: `app/opengraph-image.tsx` — generated via Next.js ImageResponse at build time
- Sitemap: `app/sitemap.ts` — single-page app, one canonical URL
- robots.txt: `public/robots.txt`
- llms.txt: `public/llms.txt` — AI agent / LLM recruiter discovery format; keep up to date
- /api/erik.json: `app/api/erik.json/route.ts` — structured HiringProfile for AI parsers; 24h edge cache (`Cache-Control: public, max-age=86400`)
- This is a hiring artifact — every SEO decision should optimize for recruiter and AI-agent discovery
- No additional analytics (no GA, no Mixpanel) — only Vercel Web Analytics + Speed Insights
- Single-page SPA: canonical URL is the root `/`; no per-section URLs to optimize
EOF
```

- [ ] **Step 5: Verify both agent files exist with portfolio context**

```bash
grep -l "Portfolio project context" \
  "~/.claude/agents/ai-engineer.md" \
  "~/.claude/agents/seo-specialist.md"
```

Expected: both paths printed.

---

## Task 4 — Install DX + dependency agents

**Files:**
- Create: `~/.claude/agents/dx-optimizer.md`
- Create: `~/.claude/agents/dependency-manager.md`

- [ ] **Step 1: Copy dx-optimizer from marketplace**

```bash
cp "~/.claude/plugins/marketplaces/voltagent-subagents/categories/06-developer-experience/dx-optimizer.md" \
   "~/.claude/agents/dx-optimizer.md"
```

- [ ] **Step 2: Append portfolio context to dx-optimizer**

```bash
cat >> "~/.claude/agents/dx-optimizer.md" << 'EOF'

## Portfolio project context
- Package manager: pnpm 10 only (never npm or yarn)
- Dev server: `pnpm dev` (Turbopack — `next dev --turbopack`)
- Pre-commit hook: `.husky/pre-commit` — target chain: `pnpm check && pnpm typecheck && pnpm validate-content && pnpm test`
- Pre-push hook: `.husky/pre-push` — validates branch name pattern `^(feat|fix|chore|docs|refactor|perf|test|build|ci|style|revert)/.+$|^main$`
- CI: `.github/workflows/ci.yml` — two jobs: build-and-gate (12min timeout) and e2e (10min timeout, needs build-and-gate)
- Linter: Biome (not ESLint/Prettier) — `pnpm biome ci .` for CI, `pnpm check` for local
- Type check: `pnpm tsc --noEmit` (alias: `pnpm typecheck`)
- Content validation: `node scripts/validate-content.mjs` (alias: `pnpm validate-content`)
- Node 22+, pnpm 10+ enforced in `package.json` engines field
- Desired new script: `"ci:local": "pnpm check && pnpm typecheck && pnpm validate-content && pnpm test"`
EOF
```

- [ ] **Step 3: Copy dependency-manager from marketplace**

```bash
cp "~/.claude/plugins/marketplaces/voltagent-subagents/categories/06-developer-experience/dependency-manager.md" \
   "~/.claude/agents/dependency-manager.md"
```

- [ ] **Step 4: Append portfolio context to dependency-manager**

```bash
cat >> "~/.claude/agents/dependency-manager.md" << 'EOF'

## Portfolio project context
- Package manager: pnpm 10; lockfile is `pnpm-lock.yaml` (source of truth for CI)
- Client JS budget: 43KB gzipped total across all islands; per-route: 120KB gzipped
- Bundle gate script: `node scripts/check-bundle-size.mjs --max-route-kb=120 --max-client-kb=320`
- `zod` is exact-pinned at current version — do not upgrade without deliberate review (minor bumps break type inference)
- All deps in package.json use caret semver; lockfile pins exact versions
- CI runs `pnpm install --frozen-lockfile` — lockfile must always be committed after dep changes
- Flag any new client-side dep > 5KB gzipped before it lands in main
- Run `pnpm up --latest` for bumps (except zod); verify lockfile diff before committing
EOF
```

- [ ] **Step 5: Verify both agent files exist with portfolio context**

```bash
grep -l "Portfolio project context" \
  "~/.claude/agents/dx-optimizer.md" \
  "~/.claude/agents/dependency-manager.md"
```

Expected: both paths printed.

- [ ] **Step 6: Verify full agent roster — all 14 agents present**

```bash
ls ~/.claude/agents/ | sort
```

Expected output includes all of:
```
accessibility-tester.md
ai-engineer.md
architect-reviewer.md
code-reviewer.md
dependency-manager.md
documentation-engineer.md
dx-optimizer.md
nextjs-developer.md
performance-engineer.md
refactoring-specialist.md
security-auditor.md
seo-specialist.md
test-automator.md
typescript-pro.md
ui-ux-tester.md
```

---

## Task 5 — Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the project agent dispatch table after the Operating role section**

In `CLAUDE.md`, find the line:

```
## Stack (locked)
```

Insert the following block immediately before it (after the blank line that follows the Operating role section):

```markdown
## Project agent dispatch

Invoke the named agent before the described action. These are definitions of done, not optional review steps.

| Phase | Trigger | Agent |
|---|---|---|
| Planning | Before invoking `writing-plans` on any spec | `architect-reviewer` |
| Implementation | After editing `app/`, `components/`, or `lib/` files | `nextjs-developer` |
| Type safety | After editing `content/*.ts` or `content/schemas.ts` | `typescript-pro` |
| Testing | When writing or modifying tests in `__tests__/` or `tests/` | `test-automator` |
| Visual QA | After any UI change — section layout, CSS, responsive | `ui-ux-tester` |
| AI feature | After editing `app/api/ask/` or `lib/stream-protocol.ts` | `ai-engineer` |
| SEO | After editing `app/opengraph-image.tsx`, `sitemap.ts`, `robots.txt`, `llms.txt` | `seo-specialist` |
| DX/Tooling | After editing `.husky/`, `ci.yml`, `vitest.config.ts`, `playwright.config.ts` | `dx-optimizer` |
| Bundle | After adding any new dependency to `package.json` | `dependency-manager` |
| Performance | After any Lighthouse-affecting change | `performance-engineer` |
| Accessibility | After editing any component with interactive or semantic elements | `accessibility-tester` |
| Code review | Before any commit on a PR branch | `code-reviewer` |
| Security | After editing `app/api/`, `lib/rate-limit.ts`, or `.env.example` | `security-auditor` |
| Refactoring | When restructuring components or CSS without behavior change | `refactoring-specialist` |

```

- [ ] **Step 2: Add spec-gate rule to the When in doubt section**

Find the line:

```
- If the request seems to conflict with a budget or gate, surface the conflict before complying.
```

Append after it:

```markdown
- Before invoking `writing-plans`, dispatch `architect-reviewer` against the spec. It must clear: (1) no new client islands without a 43KB budget justification, (2) no pattern listed in `DECISIONS.md` as rejected, (3) no item from the "Out of scope" list in this file.
```

- [ ] **Step 3: Verify both new blocks are present**

```bash
grep -c "Project agent dispatch" CLAUDE.md && grep -c "architect-reviewer" CLAUDE.md
```

Expected: `1` then `2` (appears in dispatch table heading and spec-gate rule).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "feat(claude-md): add 14-agent dispatch table and spec-gate rule"
```

---

## Task 6 — Expand settings.local.json

**Files:**
- Modify: `.claude/settings.local.json`

- [ ] **Step 1: Add missing skills to the allow list**

Open `.claude/settings.local.json`. The current `allow` array ends before the closing `]`. Add these 13 entries to the allow array:

```json
"Skill(superpowers:verification-before-completion)",
"Skill(superpowers:systematic-debugging)",
"Skill(code-review:code-review)",
"Skill(commit-commands:commit-push-pr)",
"Skill(security-review)",
"Skill(thinking-pre-mortem)",
"Skill(thinking-opportunity-cost)",
"Skill(thinking-second-order)",
"Skill(thinking-reversibility)",
"Skill(thinking-inversion)",
"Skill(thinking-leverage-points)",
"Skill(thinking-model-router)",
"Skill(pr-review-toolkit:review-pr)"
```

The final `settings.local.json` should be:

```json
{
  "permissions": {
    "allow": [
      "Skill(superpowers:brainstorming)",
      "Skill(superpowers:writing-plans)",
      "WebFetch(domain:claude.ai)",
      "Skill(update-config)",
      "mcp__plugin_playwright_playwright__browser_navigate",
      "mcp__plugin_playwright_playwright__browser_take_screenshot",
      "mcp__plugin_playwright_playwright__browser_resize",
      "mcp__plugin_playwright_playwright__browser_evaluate",
      "Skill(superpowers:subagent-driven-development)",
      "Skill(superpowers:finishing-a-development-branch)",
      "Skill(commit-commands:commit)",
      "Bash(rm -rf .git)",
      "Bash(git init *)",
      "Bash(git branch *)",
      "mcp__plugin_chrome-devtools-mcp_chrome-devtools__new_page",
      "mcp__plugin_chrome-devtools-mcp_chrome-devtools__resize_page",
      "mcp__plugin_chrome-devtools-mcp_chrome-devtools__take_screenshot",
      "mcp__plugin_chrome-devtools-mcp_chrome-devtools__evaluate_script",
      "mcp__chrome-devtools-real__list_pages",
      "mcp__chrome-devtools-real__navigate_page",
      "mcp__chrome-devtools-real__resize_page",
      "mcp__chrome-devtools-real__take_screenshot",
      "mcp__chrome-devtools-real__evaluate_script",
      "mcp__chrome-devtools-real__emulate",
      "Skill(superpowers:verification-before-completion)",
      "Skill(superpowers:systematic-debugging)",
      "Skill(code-review:code-review)",
      "Skill(commit-commands:commit-push-pr)",
      "Skill(security-review)",
      "Skill(thinking-pre-mortem)",
      "Skill(thinking-opportunity-cost)",
      "Skill(thinking-second-order)",
      "Skill(thinking-reversibility)",
      "Skill(thinking-inversion)",
      "Skill(thinking-leverage-points)",
      "Skill(thinking-model-router)",
      "Skill(pr-review-toolkit:review-pr)"
    ],
    "defaultMode": "bypassPermissions"
  }
}
```

- [ ] **Step 2: Validate JSON is well-formed**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.local.json','utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Verify skill count increased**

```bash
grep -c "Skill(" .claude/settings.local.json
```

Expected: `20` (7 existing + 13 new).

- [ ] **Step 4: Commit**

```bash
git add .claude/settings.local.json
git commit -m "feat(settings): expand skill allowlist with 13 dispatch-table skills"
```

---

## Task 7 — Harden pre-commit hook + add ci:local script

**Files:**
- Modify: `.husky/pre-commit`
- Modify: `package.json`

- [ ] **Step 1: Replace pre-commit hook content**

Overwrite `.husky/pre-commit` with:

```sh
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

- [ ] **Step 2: Verify the hook content**

```bash
cat .husky/pre-commit
```

Expected:
```
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

- [ ] **Step 3: Run the new hook chain manually to confirm it passes**

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all four commands pass. Biome outputs no errors, tsc outputs nothing, validate-content outputs nothing, Vitest shows `15 passed`.

- [ ] **Step 4: Add ci:local script to package.json**

In `package.json`, find the `"scripts"` block. After the `"prepare"` line, add:

```json
"ci:local": "pnpm check && pnpm typecheck && pnpm validate-content && pnpm test",
```

The scripts block should now contain:

```json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "check": "biome check .",
  "check:fix": "biome check --write .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "lhci": "lhci autorun",
  "validate-content": "node scripts/validate-content.mjs",
  "bundle-check": "node scripts/check-bundle-size.mjs",
  "ci": "pnpm check && pnpm typecheck && pnpm validate-content && pnpm test && pnpm build && pnpm bundle-check",
  "ci:local": "pnpm check && pnpm typecheck && pnpm validate-content && pnpm test",
  "commit": "cz",
  "prepare": "husky || true"
},
```

- [ ] **Step 5: Verify ci:local runs cleanly**

```bash
pnpm ci:local
```

Expected: exits 0. All four steps pass.

- [ ] **Step 6: Commit**

```bash
git add .husky/pre-commit package.json
git commit -m "feat(dx): harden pre-commit to full fast-gate chain, add ci:local script"
```

---

## Final verification

- [ ] **Confirm all 9 new agents installed with portfolio context blocks**

```bash
for agent in architect-reviewer nextjs-developer typescript-pro test-automator ui-ux-tester ai-engineer seo-specialist dx-optimizer dependency-manager; do
  count=$(grep -c "Portfolio project context" "~/.claude/agents/${agent}.md" 2>/dev/null || echo 0)
  echo "${agent}: ${count}"
done
```

Expected: all nine show `1`.

- [ ] **Confirm CLAUDE.md has both new sections**

```bash
grep -n "Project agent dispatch\|architect-reviewer.*spec" CLAUDE.md
```

Expected: two matching lines.

- [ ] **Confirm settings.local.json is valid and has 20 skill entries**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.local.json','utf8')); console.log('valid')" && grep -c "Skill(" .claude/settings.local.json
```

Expected: `valid` then `20`.

- [ ] **Confirm pre-commit chain passes**

```bash
pnpm ci:local
```

Expected: exits 0.

---

## Self-review

**Spec coverage:**
- 9 agent installs (Tasks 1–4) ✓ — each agent from spec Section 1a has a task with copy + append steps
- 5 reused agents — no task needed (already installed, wired via CLAUDE.md dispatch table)
- CLAUDE.md dispatch table (Task 5) ✓
- CLAUDE.md spec-gate rule (Task 5) ✓
- settings.local.json expansion (Task 6) ✓
- Pre-commit hardening (Task 7) ✓
- ci:local script (Task 7) ✓

**Placeholder scan:** All steps contain exact bash commands or exact file content. No "TBD", "TODO", or "similar to Task N" patterns. All portfolio context blocks are the full text, not references.

**Type consistency:** No code types involved — all changes are bash, JSON, and markdown. No type inconsistencies possible.

**Note on git commits for agent installs:** Agent files live in `~/.claude/agents/` which is outside this repository. Tasks 1–4 have no git commit step because the changes are global to the user's Claude config, not repo-tracked. Tasks 5–7 are repo changes and each has a commit.
