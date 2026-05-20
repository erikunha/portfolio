# CLAUDE.md

> Auto-loaded by Claude Code every session in this repo. Keep it tight — verbosity costs token budget on every invocation.

## Project

**erikunha.com.br** — personal portfolio. Hiring artifact for Staff/Principal Frontend + applied-AI roles. Matrix/brutalist terminal aesthetic. Single-page composition with ~18 sections.

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
| Code review | Before any commit on a PR branch | `code-reviewer` |
| Security | After editing `app/api/`, `lib/rate-limit.ts`, `.env.example`, or `proxy.ts` | `security-auditor` |
| Edge/routing | After editing `proxy.ts` or `next.config.ts` | `nextjs-developer` + `performance-engineer` |
| Refactoring | When restructuring components or CSS without behavior change | `refactoring-specialist` |

## Skill dispatch

Invoke the named skill inline (not as a subagent) before the described action.

| Trigger | Skill |
|---|---|
| After editing any file in `components/` or `app/` | `react-best-practices` |
| After editing `next.config.ts`, `.env.example`, or Vercel config | `vercel:nextjs` |
| After editing `app/api/` or `proxy.ts` | `vercel:vercel-functions` |
| When writing or modifying any test in `__tests__/` or `tests/` | `superpowers:test-driven-development` |
| Before any UI code review (alongside `ui-ux-tester` dispatch) | `web-design-guidelines` |

## Stack (locked)

- Next.js 15 App Router · React 19 · TypeScript strict · Biome · pnpm
- **CSS:** hand-rolled global CSS in 10 files under `app/css/`, BEM-ish naming, tokens centralized in `_tokens.css`, no framework. PostCSS pipeline removed — Next 16 + Turbopack handles nesting + autoprefix natively via Lightning CSS. _Tailwind v4 was removed 2026-05-18; see DECISIONS.md. Do not re-add._
- Vercel Edge end-to-end deployment
- Upstash Redis for rate-limit + KV log
- Anthropic SDK with `claude-haiku-4-5-20251001` for `/api/ask`
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

## Reference standards (post-audit 2026-05-19)

Established by the Principal/Staff audit (`docs/audit/2026-05-19-principal-audit.md`). Each is binding on every PR.

1. **Doc-vs-code is a CI gate.** Every claim in `ARCHITECTURE.md` that names a file, function, or numeric budget MUST be verifiable by `scripts/audit/`. ADR entries in `DECISIONS.md` MUST reference the SHA they ship in.
2. **`'use client'` is named and enforced.** Every file with `'use client'` MUST end in `.client.tsx`. CI gate via Biome custom rule or `scripts/check-client-naming.mjs`. No `.client.tsx` file may export an `async function`.
3. **One API envelope.** Every `/api/*` returns `{ ok: true, requestId, data? } | { ok: false, requestId, error: { code, message, issues? } }` with `X-Request-Id` header. Order is `rate-limit → parse → validate → handle`. Centralized via `lib/server/route.ts`.
4. **No dead-code security theater.** Every CSP directive MUST have a consumer or be deleted. Every cache directive MUST verifiably activate. Every kill switch MUST have a Vitest *behavioral* test (not source-grep).
5. **Tests assert behavior, not source.** No `__tests__/*.ts` may use `indexOf` on file source to verify ordering. `e2e-full` is REQUIRED, not promote-after-stable.
6. **Budgets bind in the smallest unit.** Bundle gate measures *application-only* JS (excluding Next framework bootstrap). Any route calling `headers()` / `cookies()` / `force-dynamic` requires an ADR entry justifying the cost.
7. **AI features are measured.** `/api/ask` SYSTEM prompt MUST be ≥ 1024 tokens for Haiku ephemeral cache to fire. Cache hit rate (`cache_read_input_tokens / input_tokens > 0.7`) is tracked. `pnpm ask:eval` reads the 90d Q+A log against a rubric; deltas committed to `DECISIONS.md` on SYSTEM changes.
8. **A11y is a unit test.** Every interactive client component has a Vitest test asserting tab order, focus visibility, keyboard activation, and SR announcement. Streaming UI emits discrete DOM nodes per chunk (NOT `textContent` mutation on a shared node).
9. **DX is measured in seconds per commit.** Pre-commit runs only `pnpm check` (sub-second). `pre-push` runs `typecheck + validate-content + test`. `pnpm verify` is the named pre-PR command.
10. **Reproducibility is the default.** Every dep pinned to major-locked range (`^16.2.6`, not `latest`). `strip-next-polyfills.mjs` verifies target checksum before overwriting; fail loud on mismatch.

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
- **The Matrix dialog loop MUST use `useRef.textContent` mutation, NOT per-keystroke `useState`.** Per-state re-renders tank INP. (PR 7 of the audit roadmap adds the missing Vitest enforcement test — see `docs/audit/2026-05-19-principal-audit.md` Theme 1.8.)

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
6. **The branch protection rule must stay enabled.** `pnpm ready-to-merge <pr>` runs `scripts/check-branch-protection.ts` against `main` and fails if `required_conversation_resolution` is off. This is a local gate, not a CI step: the workflow `GITHUB_TOKEN` cannot read the branch-protection endpoint (it requires repo-admin token power). See `DECISIONS.md`.

Rationale: human-in-the-loop quality gate for AI-assisted development on a Staff/Principal-bar artifact. See `DECISIONS.md` for residual-risk note.

## Things that have been considered and rejected

Before proposing any of these, check `DECISIONS.md` to see the reasoning that excluded them:
- GraphQL · Cloudflare Workers · multi-region deploy · Sentry by default · CAPTCHA on the contact form · separate routes per section · state management library · design system extraction · MDX · separate CMS · Tailwind (removed 2026-05-18) · CSS Modules / CSS-in-JS / styled-components · PostCSS plugins beyond what Lightning CSS provides natively

## Reference docs in this repo

- `ARCHITECTURE.md` — system design, deep dive, trade-offs
- `DECISIONS.md` — running ADR log
- `LAUNCH.md` — 14-day implementation playbook
- `docs/audit/2026-05-19-principal-audit.md` — Principal/Staff pass audit; 12 themes, 5 debates, 10 standards, 8-PR roadmap
- `scaffold/` — drop-in opinionated configs (Biome, tsconfig, globals.css, Zod schemas, CI workflow)
- `scaffold/README.md` — explains every file in scaffold/
- `prototype/Portfolio.html` — the Claude Design prototype (visual reference only, never served)

## When in doubt

- Read `ARCHITECTURE.md` §16 ("What I'd revisit as the system grows") before proposing infrastructure changes.
- Read `LAUNCH.md` PR-by-PR order before suggesting we skip ahead.
- If the request seems to conflict with a budget or gate, surface the conflict before complying.
- Before invoking `writing-plans`, dispatch `architect-reviewer` against the spec. It runs the four-gate spec-gate protocol and must return `GATE_RESULT: PASS` before `writing-plans` proceeds.
