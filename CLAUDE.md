# CLAUDE.md

> Auto-loaded by Claude Code every session in this repo. Keep it tight — verbosity costs token budget on every invocation.

## Project

**erikunha.dev** — personal portfolio. Hiring artifact for Staff/Principal Frontend + applied-AI roles. Matrix/brutalist terminal aesthetic. Single-page composition with ~18 sections.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright E2E — observability smoke, a11y scan, contact + ask user-journey tests, visual regression |
| `pnpm check` | Biome lint + format check |
| `pnpm check:fix` | Biome auto-fix |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm lhci` | Lighthouse CI locally |
| `pnpm validate-content` | Zod content schema validation |
| `pnpm ci:local` | Full local CI gate (lint + type + test) |
| `pnpm bundle-check` | Bundle size gate check |
| `pnpm ready-to-merge [-- <pr>]` | Pre-merge gate: full CI + every GH review thread resolved |

## Operating role

Operate at Staff/Principal frontend engineer standard. The site is itself the hiring pitch. Code quality, architecture decisions, perf budgets, and a11y are part of the pitch, not afterthoughts.

This means:
- Cross-cutting concerns over local optimization
- Mechanism-level reasoning (cause → effect), not pattern-matching
- Trade-offs surfaced explicitly; one recommendation per decision
- Perf, a11y (WCAG 2.1 AA), and security are implicit requirements on every change, not separate phases

## Project agent dispatch

Invoke the named agent before the described action. These are definitions of done, not optional review steps.

| Phase | Trigger | Agent |
|---|---|---|
| Planning | Before invoking `writing-plans` on any spec | `architect-reviewer` |
| Implementation | After editing `app/`, `components/`, or `lib/` files | `nextjs-developer` |
| Type safety | After editing `content/*.ts` | `typescript-pro` |
| Testing | When writing or modifying tests in `__tests__/` or `tests/` | `test-automator` |
| Visual QA | After any UI change — section layout, CSS, responsive | `ui-ux-tester` |
| AI feature | After editing `app/api/ask/` or `lib/stream-protocol.ts` | `ai-engineer` |
| SEO | After editing `app/opengraph-image.tsx`, `sitemap.ts`, `robots.txt`, `llms.txt` | `seo-specialist` |
| DX/Tooling | After editing `.husky/`, `ci.yml`, `vitest.config.ts`, `playwright.config.ts`, `.github/workflows/`, `scripts/`, `biome.json`, `commitlint.config.ts` | `dx-optimizer` |
| Bundle | After adding any new dependency to `package.json` | `dependency-manager` |
| Performance | After any Lighthouse-affecting change | `performance-engineer` |
| Accessibility | After editing any component with interactive or semantic elements | `accessibility-tester` |
| **Code review** | **Before any commit on a PR branch — no exceptions, no "minor" exemptions** | **`code-reviewer`** |
| Security | After editing `app/api/`, `lib/rate-limit.ts`, `.env.example`, or `proxy.ts` | `security-auditor` |
| Edge/routing | After editing `proxy.ts` or `next.config.ts` | `nextjs-developer` + `performance-engineer` |
| Refactoring | When restructuring components or CSS without behavior change | `refactoring-specialist` |

## Skill dispatch

Invoke the named skill inline (not as a subagent) before the described action.

| Trigger | Skill |
|---|---|
| **Before writing any new file, function, or script** | **`thinking-inversion` — what specifically makes this fail? answers become test cases** |
| **Before implementing any new file, function, or script** | **`superpowers:test-driven-development` — tests first, always; implementation satisfies them** |
| After editing any file in `components/` or `app/` | `react-best-practices` |
| After editing `next.config.ts`, `.env.example`, or Vercel config | `vercel:nextjs` |
| After editing `app/api/` or `proxy.ts` | `vercel:vercel-functions` |
| Before any UI code review (alongside `ui-ux-tester` dispatch) | `web-design-guidelines` |

## Stack (locked)

- Next.js 16 App Router · React 19 · TypeScript strict · Biome · pnpm
- **CSS:** hand-rolled global CSS in 10 files under `app/css/`, BEM-ish naming, tokens centralized in `_tokens.css`, no framework. PostCSS pipeline removed — Next 16 + Turbopack handles nesting + autoprefix natively via Lightning CSS. _Tailwind v4 was removed 2026-05-18; see DECISIONS.md. Do not re-add._
- Vercel Edge end-to-end deployment
- Upstash Redis for rate-limit + KV log
- Vercel AI Gateway via the AI SDK v6 (`ai` package, `streamText`) with the model string `anthropic/claude-haiku-4-5` for `/api/ask`; ephemeral prompt cache preserved via `providerOptions.anthropic.cacheControl`. Needs `AI_GATEWAY_API_KEY` (OIDC token on Vercel). Migrated 2026-05-21 — see DECISIONS.md.
- Resend for contact form delivery
- Playwright E2E: observability smoke (`tests/e2e/observability-smoke.spec.ts`), a11y scan (`tests/a11y/axe.spec.ts`), contact + ask user-journey tests, visual regression snapshots; 4-project matrix (chromium/webkit x desktop/mobile)
- Vitest unit tests
- axe-core a11y CI gate
- Lighthouse CI gates

See `ARCHITECTURE.md` for the full system design, `DECISIONS.md` for the running ADR log, `LAUNCH.md` for the day-by-day implementation playbook.

## Performance budgets (non-negotiable)

| Metric | Budget |
|---|---|
| LCP | < 1.8s on 4G |
| INP | < 200ms |
| CLS | < 0.05 |
| JS gzipped per route | < 120KB |
| Client JS total (all islands combined) | < 43KB |
| Lighthouse Performance | ≥ 95 |
| Lighthouse Accessibility | = 100 |
| Lighthouse Best Practices | ≥ 95 |
| Lighthouse SEO | = 100 |

CI enforces all of the above. **Never disable the gates to merge.** If a gate fails, fix the underlying issue.

## Engineering standards

The canonical engineering bar lives in `STANDARDS.md` — 11 domain chapters, each naming its enforcement mechanism (a CI gate, a PR-review item, or culture). It supersedes the prior inline 10-standard list established by the 2026-05-19 Principal/Staff audit. Every PR is held to it. When a request seems to conflict with a chapter, surface the conflict before complying.

## Package + manager policy

- **pnpm only.** `packageManager: pnpm@latest`. Don't use npm or yarn.
- Every dep installed `@latest` at scaffold; `pnpm up --latest` for bumps.
- `zod` is exact-pinned (`-E`) — its minor bumps break inference. Upgrade deliberately.
- Caret semver in `package.json`; lockfile (`pnpm-lock.yaml`) is the source of truth.
- CI runs `pnpm install --frozen-lockfile`.
- Node 22+, pnpm 10+.

## Rendering model

- **Default: React Server Components, SSG at build time.** Zero JS shipped for static sections.
- **Client islands by exception:** Matrix dialog loop, INTERACTIVE_SHELL, contact form, IntersectionObserver typewriter, MOTION indicator.
- All client files named `*.client.tsx`. RSC drift must be visible in PR review.
- **The Matrix dialog loop MUST use `useRef.textContent` mutation, NOT per-keystroke `useState`.** Per-state re-renders tank INP. The interactive shell's streaming answer, by contrast, renders *through* React (rAF-coalesced state) — see `STANDARDS.md` Chapter 1; enforced by `__tests__/InteractiveShell.streaming.test.ts`.

## Aesthetic constraints

- Pure black background (`#000000`), lime signal-green (`#00FF41`) for accents.
- Two-token palette: `--signal` for headings/accents/large text; `--fg` (#E6FFE6, ~13:1 contrast) for body. Never use `--signal` for paragraph text — it fails WCAG AA.
- JetBrains Mono everywhere (self-hosted via `next/font/local`, not Google CDN).
- The "THE MATRIX HAS YOU." headline is a heavy geometric sans (Geist Black or similar). All other text is mono.
- CRT effects (scanlines + RGB sub-pixel mask + grain + scan beam + flicker + phosphor text-shadow) at dialed-back opacity. All disabled under `prefers-reduced-motion: reduce`.
- 1px borders only, sharp corners (no rounded radius > 2px).

## Content discipline

- All content lives in `content/*.ts` as typed TS modules validated by Zod at build time. Build fails on schema violation.
- HOTTEST_TAKES, `~/.guitar_rig`, `~/.now`, `~/.unknowns`, `~/.community`, `~/.visa`, `~/.credentials` — all driven from content files.
- Never inline content in JSX. If you find yourself typing user-facing copy into a `.tsx`, stop and move it to `content/`.

## Working agreement

- Lead with the recommendation. For decisions: 2-3 options, trade-offs, failure modes, one discriminator, recommend one.
- Show diffs and targeted snippets over full rewrites unless the change is pervasive.
- Comment non-obvious logic only.
- Don't ask clarifying questions unless missing info would change the decision — assume reasonably, state in one line, proceed.
- Flag flaws once. Don't repeat concerns.
- Skip disclaimers, boilerplate, "consult a professional" lines.
- Skip tutorials and 101 content — the user is 8+ years in.
- Track decisions in `DECISIONS.md`: one bullet, date, reversibility note. Update as we go.
- **Process feedback mid-workflow is a hard stop.** When the user gives process or workflow feedback while a task is executing: pause immediately, incorporate it into CLAUDE.md and/or memory, confirm the change with the user, then resume. Do not barrel through to completion and address feedback after the fact.
- **Code review is not optional on PR branches.** Run `code-review:code-review` on the staged diff before every commit — scripts, config files, routes, and one-liners all count. "It's just a small change" is not an exemption. Skipping this step is the direct cause of multi-round Copilot review cycles (PR #36: 3 rounds, 12 preventable findings). The review catches TypeScript safety issues (`err.message` on `unknown`), input validation gaps (NaN bypass), missing tests, and documentation accuracy before they reach Copilot.
- **The review should be boring.** If `code-review:code-review` or Copilot finds real bugs, the pre-implementation discipline failed — not the review. Principal/Staff level means bugs don't reach the review; the test suite already encodes the failure modes found by `thinking-inversion`. Multi-round Copilot cycles are a signal to fix the writing process, not the reviewing process.

## Out of scope (unless asked)

- i18n
- Light theme toggle (the whole point is dark)
- Blog / MDX content engine
- Analytics beyond Vercel Web Analytics + Speed Insights
- Auth, accounts, comments
- CMS (single-author, content in TS)

## PR merge gate

Before any agent or human calls `gh pr merge` on this repo:

1. **GitHub resolve-thread is ground truth.** A PR may not merge while `gh api graphql` returns any `PullRequestReviewThread` with `isResolved: false`. Enforced by GitHub branch protection (`required_conversation_resolution`) and by `pnpm ready-to-merge <pr>` locally.
2. **AI agents must RESOLVE or ESCALATE every open comment.** RESOLVE = address with a fix commit and reply with the SHA. ESCALATE = surface to the human owner with the comment verbatim, 2-3 options, and a recommendation; wait for a decision. No third bucket. "Looks minor" is not allowed.
3. **In-session reviewer findings count.** Output from `pr-review-toolkit:review-pr`, `code-review:code-review`, or `ultrareview` must be posted to the PR before merge so they fall under rule 1.
4. **Self-resolve is detectable.** `scripts/check-pr-comments.ts` warns when the PR author is also the thread resolver. Document the override on the PR if intentional.
5. **Mechanical command.** `pnpm ready-to-merge <pr>` runs `pnpm ci:local` (lint + typecheck + content validate + client-naming + tests), the branch-protection check, then queries unresolved threads. Must pass before `gh pr merge`.
6. **The branch protection rule must stay enabled.**
8. **Local playwright visual check before merge.** After all review fixes are pushed, start the dev server (`pnpm dev`) and use playwright MCP to verify desktop (1280×720) and mobile (375×812). Check all changed sections and the golden path. CI visual snapshots compare against a frozen baseline — they don't catch intent regressions.
9. **Rebase before merge (non-dependabot only).** Run `git fetch && git rebase origin/main` before merging. Keeps a linear history on main. Skip for `dependabot/*` branches — those are auto-managed and rebasing breaks their signature. `pnpm ready-to-merge <pr>` runs `scripts/check-branch-protection.ts` against `main` and fails if `required_conversation_resolution` is off. This is a local gate, not a CI step: the workflow `GITHUB_TOKEN` cannot read the branch-protection endpoint (it requires repo-admin token power). See `DECISIONS.md`.
7. **Copilot auto-reviews on PR open; reply to threads + re-request after every review-feedback push.** Copilot reviews a PR automatically on *open* — do NOT post any comment on open. After any push that addresses Copilot or reviewer feedback:
   - **Thread replies (required):** reply to each resolved thread: `gh api repos/erikunha/portfolio/pulls/<pr>/comments/<databaseId>/replies -f body="Fixed in <sha>. <one-sentence technical reason>"`. This closes the feedback loop in context for each finding.
   - **Re-request (required):** `gh pr edit <pr> --add-reviewer copilot-pull-request-reviewer`. This is the trigger — Copilot sees the new commits + the thread replies.
   - **No PR-level comment.** Do not post a general comment on the PR timeline (e.g. "What changed since your last review", "Addressed feedback", etc.) — that is redundant noise. Thread replies + re-request is the complete sequence.
   - Note: the raw REST `requested_reviewers` API and GraphQL `requestReviews` mutation both reject Copilot as `not a collaborator`; `gh pr edit` uses a different mechanism that works.

Rationale: human-in-the-loop quality gate for AI-assisted development on a Staff/Principal-bar artifact. See `DECISIONS.md` for residual-risk note.

## Things that have been considered and rejected

Before proposing any of these, check `DECISIONS.md` to see the reasoning that excluded them:
- GraphQL · Cloudflare Workers · multi-region deploy · Sentry by default · CAPTCHA on the contact form · separate routes per section · state management library · design system extraction · MDX · separate CMS · Tailwind (removed 2026-05-18) · CSS Modules / CSS-in-JS / styled-components · PostCSS plugins beyond what Lightning CSS provides natively

## Reference docs in this repo

- `STANDARDS.md` — the canonical engineering bar; 11 domain chapters, each naming its enforcement mechanism
- `ARCHITECTURE.md` — system design, deep dive, trade-offs
- `DECISIONS.md` — running ADR log
- `LAUNCH.md` — historical launch playbook (superseded; `STANDARDS.md` + `ARCHITECTURE.md` are authoritative)
- `docs/audit/2026-05-19-principal-audit.md` — Principal/Staff pass audit (historical; superseded by `STANDARDS.md`)
- `scaffold/` — drop-in opinionated configs (Biome, tsconfig, globals.css, Zod schemas, CI workflow)
- `scaffold/README.md` — explains every file in scaffold/
- `prototype/Portfolio.html` — the Claude Design prototype (visual reference only, never served)

## When in doubt

- Read `ARCHITECTURE.md` §16 ("What I'd revisit as the system grows") before proposing infrastructure changes.
- Read `LAUNCH.md` PR-by-PR order before suggesting we skip ahead.
- If the request seems to conflict with a budget or gate, surface the conflict before complying.
- Before invoking `writing-plans`, dispatch `architect-reviewer` against the spec. It runs the four-gate spec-gate protocol and must return `GATE_RESULT: PASS` before `writing-plans` proceeds.
