# Reference Standards & Improvement Program — Design Spec

- **Date:** 2026-05-20
- **Status:** Approved — architect-reviewer spec gate `GATE_RESULT: PASS` (2026-05-20); advisory ordering refinements folded in
- **Branch:** a new dedicated branch cut from `main`
- **Author:** Erik Cunha

## 1. Context & goal

`erikunha.dev` is a Next.js 15 / React 19 personal portfolio that doubles as a Staff/Principal
hiring artifact. A fresh Principal-level audit — five parallel exploration agents plus direct
ground-verification of every contested claim — confirmed the codebase is **top-decile**: the prior
8-PR audit roadmap shipped, the architecture is sound (static-generated root, RSC-default with an
enforced client boundary, a centralized API envelope, real kill switches, a comprehensive unit +
e2e test suite, Lighthouse + axe CI gates).

This program is therefore **not a teardown**. It addresses the remaining marginal frontier —
reproducibility discipline, CI-gate enforcement, test-suite quality, one fragile streaming
pattern, and polish — and produces a fresh authoritative `STANDARDS.md`.

### Goals

1. **`STANDARDS.md`** — a canonical, domain-chapter reference document. Every standard states, in
   prose, *how it is held* (mechanical gate / PR review / culture). It supersedes the 10 inline
   standards in `CLAUDE.md`.
2. **Exhaustive remediation** of every verified audit finding (Tier 1, 2, and 3).
3. **One consolidated PR**, structured as logically-grouped, individually-revertable commits — one
   commit per workstream — so review and `git bisect` still function on a large diff.
4. **Remove the GitHub Copilot port** entirely (added per user direction, 2026-05-20) — the
   harness, generated `.github/` artifacts, tests, and `AGENTS.md`. See CG0.

### Non-goals

See §9 (Out of scope).

## 2. Audit method note (why findings were filtered)

The documentation-audit agent returned a wall of "CRITICAL" security findings — missing prompt-
injection guard, dead prompt cache, unchecked honeypot, wrong `robots.txt` domain. **Direct code
verification proved ~80% of them false.** That agent had read the *prior* audit document
(`docs/audit/2026-05-19-principal-audit.md`), which describes the pre-roadmap state, and reported
it as current. The live code has a 128-bit per-request sentinel wrapper, a working identical-
question gate, a reserve/settle budget pattern, a server-side honeypot check, and a correct
`erikunha.dev` `robots.txt`.

Only personally-verified findings appear below. The stale findings are explicitly discarded.

## 3. Verified findings

### Tier 1 — high-leverage

| # | Finding | Evidence |
|---|---------|----------|
| 1 | Dependency pinning broken — `next`, `react`, `react-dom`, `@anthropic-ai/sdk`, `resend`, `@upstash/*` and several devDeps are `"latest"`. Contradicts the stated major-lock policy. | `package.json:50-92` |
| 2 | `e2e-full` is non-required — visual + WebKit/mobile regressions can land on `main` silently. | `.github/workflows/ci.yml:163` |
| 3 | Bundle-budget theater — CI gate is `--max-client-kb=320` (full framework bundle). The `<43KB` app-JS budget is asserted nowhere. | `ci.yml:92` |
| 4 | `check:client-naming` runs only in local `pre-push`/`verify`, not in CI — a non-author can merge a violation via the GitHub UI. | `ci.yml` (absent) |
| 5 | Test suite asserts source, not behavior — 25 test files under `__tests__/` call `readFileSync`; a large share grep file contents instead of exercising code. | `__tests__/*` |
| 6 | `InteractiveShell` streaming bypasses React — manual `createElement('span')` + `appendChild` + per-chunk `textContent` mutation inside an `aria-live` region React also owns. Fragile reconciliation boundary. | `components/client/InteractiveShell.tsx:195-202` |

### Tier 2 — medium

- **Privacy:** WhatsApp number baked into the public, fetchable `/api/ask` SYSTEM prompt — `lib/ask/system-prompt.ts:34`.
- **AI robustness:** no mid-stream timeout watchdog (`/api/ask` 30s timeout covers stream *initiation* only); `INJECTION_RE` misses `<|system|>`-style delimiter formats — `app/api/ask/route.ts:25,46`. The per-request sentinel wrapper is the real guard, so the regex gap is defense-in-depth only.
- **CSS:** chrome-dot color drift (`#ff5f57` vs `#ff5f56`, `#febc2e` vs `#ffbd2e`, `#28c840` vs `#27c93f`) between `_shell.css` and `_responsive.css`; untokenized syntax colors (`#ffd86b`, `#7fe4ff`, `#ff8a8a`) repeated across files; no `@layer` cascade layers; blanket `contain-intrinsic-size: 0 400px` is an unmeasured estimate → CLS risk on varied-height modules.
- **Schemas:** loose `.string()` without `.min(1)` on user-facing content fields — `content/schemas.ts`.
- **Correctness:** `getRedis()` singleton initialization is non-atomic — `lib/rate-limit.ts`.
- **Duplication:** `GitLogSection` has two near-identical render functions; `ManPageSection` entangles desktop and mobile markup in one file.
- **Docs drift:** `CLAUDE.md` project header says `erikunha.com.br`; code ships `erikunha.dev` (layout `metadataBase`, `sitemap.ts`, `robots.txt`, SYSTEM prompt). `public/llms.txt` and several docs also carry `.com.br`. ADR SHA-reference hygiene in `DECISIONS.md` is inconsistent (post-2026-05-18 entries often omit SHAs). `HANDOFF.md` likely stale.
- **API surface:** `/api/erik.json` returns bare JSON, outside the `defineHandler` envelope and without `X-Request-Id`.

### Tier 3 — low

- `useCallback(nextId, [])` — no-op memoization of a ref-stable closure (`InteractiveShell.tsx:116`).
- dmesg boot sequence fires `dmesgLines.length` staggered `setState` calls → serial re-render storm (`components/sections/Footer.client.tsx`).
- `/api/log` smoke-prefix check is case-sensitive (`[smoke]` only) — `app/api/log/route.ts`.
- `MatrixRain` effect dependency array re-runs the rAF loop on any color/speed prop change.
- 11 pre-existing Biome warnings: `noStaticOnlyClass` (`__tests__/budget-cap.test.ts`),
  `noEmptyBlockStatements` (`__tests__/footer-lazy.test.ts`), `noNonNullAssertion`
  (`scripts/lib/copilot/tool-map.ts`), and 8 `noTemplateCurlyInString`
  (`__tests__/copilot/mcp-to-vscode.test.ts` — false positives in test descriptions/expected
  values).
- `.husky/prepare-commit-msg` is not TTY-safe — `/dev/tty: Device not configured` in
  non-interactive contexts (the failure is currently swallowed).

## 4. Deliverable 1 — `STANDARDS.md`

Format: domain-chapter prose. Each chapter states the **rule**, the **rationale**, and **how the
standard is held** — a mechanical CI gate, a PR-review checklist item, or culture. Nothing is
silently aspirational; if a rule cannot be gated, the chapter says so explicitly.

`CLAUDE.md` is rewired: the inline "Reference standards (post-audit 2026-05-19)" section is
replaced by a one-paragraph pointer to `STANDARDS.md`. `DECISIONS.md` gets an ADR entry recording
the supersession.

### Chapters

1. **Rendering & Architecture** — RSC default; client islands by exception; `.client.tsx` or
   `/client/` naming; static-first routing (`force-static` unless an ADR justifies dynamic);
   streaming UI renders *through* React — no out-of-tree DOM mutation. Held by: `check-client-naming`
   in CI.
2. **API & Server Boundary** — one response envelope; `rate-limit → parse → validate → handle`
   ordering; every outbound external call carries an explicit timeout; fail-open vs fail-closed is
   a documented choice per control. Held by: `route-handler` behavioral tests.
3. **Performance** — LCP < 1.8s, INP < 200ms, CLS < 0.05, Lighthouse Perf ≥ 95 / A11y 100 /
   Best-Practices ≥ 95 / SEO 100; budgets measured in the smallest *honest* unit — per-route First
   Load JS is gated, app-island JS is tracked. Held by: Lighthouse CI + bundle gate.
4. **Testing** — tests assert behavior, not source; `readFileSync` of application source is banned
   except for tagged config/manifest assertions; every API route, kill switch, and interactive
   client component has a behavioral test; `e2e-full` functional specs are required. Held by: CI +
   a behavioral-test meta-check.
5. **Reproducibility & Dependencies** — every dependency major-locked (`^x.y.z`), never `latest`
   or `*`; the lockfile is the source of truth; CI installs `--frozen-lockfile`. Held by: new
   `check-dep-pinning` gate in CI.
6. **Content & Type Safety** — all content lives in `content/*.ts`, Zod-validated at build; schemas
   are tight (`.min(1)`, enums over free strings, `.url()` where applicable); no user-facing copy
   in `.tsx`. Held by: `validate-content`.
7. **CSS & Visual System** — colors and sizes come from `_tokens.css` only; `@layer` cascade
   layers declare ordering explicitly; CLS-safe size reservations are measured, not estimated;
   two-token palette discipline (`--signal` for headings/accents, `--fg` for body). Held by:
   visual-regression suite + PR review.
8. **Accessibility** — WCAG 2.1 AA; Lighthouse a11y = 100; axe-core CI scan; every interactive
   component has a behavioral a11y test (tab order, focus visibility, keyboard activation, SR
   announcement). Held by: axe + Lighthouse CI + per-component tests.
9. **Security & Privacy** — no dead-code security theater (every CSP directive has a consumer;
   every kill switch has a behavioral test); PII minimization — no personal phone or private
   contact details in machine-fetchable surfaces. Held by: PR review + CSP test.
10. **Documentation & Decisions** — every file/function/budget named in `ARCHITECTURE.md` is
    verifiable against code; ADR entries cite the SHA they ship in; one canonical production
    domain across all files. Held by: PR review (a doc-claim verifier script is a stretch goal).
11. **Developer Experience** — pre-commit is sub-second (`biome check`); pre-push runs the
    heavier gate; `pnpm verify` is the named pre-PR command; CI gates are never
    disabled to merge — a failing gate means the underlying issue is fixed. Held by: git hooks +
    culture.

## 5. Deliverable 2 — Fix program (10 commit groups)

Every verified finding maps to exactly one group. Each group is one revertable commit in the
single PR. **Ordering:** CG0 lands first (isolated deletion — shrinks the surface every later
group touches). CG9 lands last — `STANDARDS.md` documents the gates CG1–CG3 create, so a
post-merge revert of any earlier group requires a `STANDARDS.md` follow-up. CG2 lands before CG6
(see CG6).

### CG0 — Remove the GitHub Copilot port

Not an audit finding — added per user direction (2026-05-20, reaffirmed: remove it "like it was
never implemented"). The Copilot-port harness — a generator, a drift gate, ~14 tests, ~40
generated `.github/` files — is a maintenance surface tangential to a portfolio. Remove it
entirely so the working tree carries no trace. Lands first: it shrinks the surface every later
group operates on and deletes work otherwise scheduled in CG3 and CG8.

**Scope boundary — résumé content stays.** Erik genuinely built GitHub Copilot subagent tooling
at Betsson; `content/employers.ts`, `content/projects.ts`, `content/hottest-takes.ts`, and the
`lib/ask/system-prompt.ts` narrative describe that real experience. Those are NOT touched —
"drop Copilot" means the *port harness in this repo*, not Erik's career history. Git history is
also not rewritten (PRs #28–#30 are merged; force-rewriting `main` is dangerous and out of
scope) — "never implemented" applies to the working tree, not the commit log. Code comments that
reference the GitHub Copilot *review bot* (e.g. "Copilot flagged this on PR #29") are accurate
review history and are left as-is.

Delete:
- `.github/chatmodes/`, `.github/prompts/`, `.github/instructions/`, `.github/copilot-instructions.md`
- `.vscode/mcp.json` (only this file; the rest of `.vscode/` stays)
- `scripts/lib/copilot/`, `scripts/sync-copilot.ts`, `scripts/copilot-port.config.ts`,
  `scripts/check-copilot-drift.ts`
- `__tests__/copilot/`, `.copilot-port-output/`
- `AGENTS.md` (per user decision — `CLAUDE.md` becomes the single agent-instruction source)
- `docs/superpowers/specs/2026-05-18-claude-to-copilot-port-design.md` and
  `docs/superpowers/plans/2026-05-18-claude-to-copilot-port.md` (the copilot-dedicated design docs)

Modify:
- `package.json` — remove the `sync:copilot` script; remove `gray-matter`, `semver`,
  `@types/semver` (confirmed unused outside the copilot port).
- `.husky/pre-commit` — remove the copilot-sync regeneration block (pre-commit becomes `pnpm check`).
- `.github/workflows/ci.yml` — remove the "Verify Copilot port artifacts in sync" step.
- `.gitignore` — remove the `.copilot-port-output/` entry.
- `CLAUDE.md`, `DECISIONS.md`, `README.md` — strip Copilot-port and `AGENTS.md` references; the
  copilot-port ADR entries are removed from `DECISIONS.md`.

`.github/workflows/ci.yml` itself stays — it is CI, not Copilot.

### CG1 — Reproducibility

- Read resolved versions from `pnpm-lock.yaml`; rewrite every `"latest"` / unbounded dependency in
  `package.json` to a caret-major range (`^x.y.z`).
- Pin `next` tightly enough that `postinstall`'s `strip-next-polyfills.mjs` checksum target stays
  stable across a fresh install. If a pin necessarily moves `next`, update the checksum in the same
  commit. The guard must keep failing loud on mismatch — never silently.
- Add `scripts/check-dep-pinning.mjs` — fails if any `dependencies`/`devDependencies` entry is
  `latest`, `*`, or otherwise unbounded.
- Wire `check-dep-pinning` into `pnpm verify` and `ci.yml`.

### CG2 — CI gate teeth

- **D1 resolved — reconciled against the real 3-job CI topology** (`build-and-gate`, `e2e`
  chromium-smoke, `e2e-full` non-required matrix incl. visual): restructure so the functional
  cross-browser specs (`contact.spec.ts`, `ask.spec.ts`, `cross-cutting.spec.ts`) run in a
  **required** matrix job across chromium + webkit + mobile, and `visual.spec.ts` is isolated as
  the sole **non-blocking** job retaining the `workflow_dispatch` baseline-refresh path. Fold or
  replace the existing `e2e` chromium-smoke job — do not duplicate its coverage. Update `ci.yml`;
  document the required job names for branch protection.
- Add `pnpm check:client-naming` as a CI step.
- Add `pnpm check:dep-pinning` as a CI step.
- **D2 resolved:** gate on per-route **First Load JS** (a stable Next build metric) at a tightened
  threshold in `check-bundle-size.mjs`; keep the 43KB app-island figure as a documented design
  target tracked via the `@next/bundle-analyzer` artifact rather than a fragile "app-only" gate.

### CG3 — Test-suite quality

- Triage all 25 `readFileSync`-using test files. Convert source-content assertions to behavioral
  assertions (render component / call handler / inspect output). Genuine config/manifest reads
  (e.g. asserting an installed dependency version) are kept and tagged with an allow-list comment.
- Add a behavioral-test meta-check: a Vitest test (or lint rule) that fails if a `__tests__` file
  reads application source via `readFileSync` without the allow-list tag. The meta-check must land
  in the same commit as (or after) the file rewrites within CG3 so CG3 does not fail its own gate.
- Fill coverage gaps: `/api/contact` rate-limit path, `/api/ask` streaming chunk parsing,
  `ContactForm` a11y (tab order / focus / SR announcement).
- No test is deleted without a behavioral replacement. Capture coverage before and after.

### CG4 — Streaming refactor

- **D3 resolved:** replace the out-of-tree `streamSpan` in `InteractiveShell` with a React-owned
  streaming node backed by a dedicated piece of state. Coalesce incoming chunks with
  `requestAnimationFrame` so React owns the DOM node but re-renders are frame-bounded — INP must
  not regress. The streaming line is its own state, not an append to the full `history` array, so
  a stream update does not re-render the entire feed.
- Verify INP locally before/after with the Chrome DevTools performance trace.

### CG5 — AI robustness + privacy

- Add a mid-stream timeout watchdog to the `/api/ask` `ReadableStream` consumer — abort and emit
  the structured error sentinel if no chunk arrives within a bounded window.
- Expand `INJECTION_RE` to also catch `<|...|>` delimiter formats (defense-in-depth; the sentinel
  wrapper remains the primary guard).
- Remove the WhatsApp phone number from `lib/ask/system-prompt.ts`; keep email. Re-verify the
  SYSTEM prompt still clears the 1024-token ephemeral-cache threshold after the edit.

### CG6 — CSS architecture

- Add `--chrome-red`, `--chrome-yellow`, `--chrome-green`, `--highlight-yellow`,
  `--highlight-cyan`, `--error-soft` (and any other duplicated literals) to `_tokens.css`; replace
  all literal occurrences. Resolve the chrome-dot drift to a single canonical value set.
- Introduce `@layer` cascade layers (`base, layout, modules, overrides`) across the 10 CSS files;
  wrap each file's rules in its layer.
- Replace the blanket `contain-intrinsic-size` with measured per-section values, or remove the
  size hint where measurement shows it is counterproductive.
- **Ordering: CG2 must land before CG6.** The `@layer` reorder can shift pixels; the
  visual-regression job must already be correctly wired (CG2) for that shift to be caught.
- The visual-regression suite is the safety net; baselines are regenerated deliberately via the
  `workflow_dispatch` path as the final step of this group.

### CG7 — Schemas & content

- Tighten `content/schemas.ts`: `.min(1)` on every user-facing label/heading/text field; enums
  where a field has a known closed set; `.url()` on URL fields. Confirm `pnpm validate-content`
  still passes against all 21 content modules.

### CG8 — Component & correctness cleanup

- `GitLogSection` — collapse the two render functions into one `renderCommit(commit, isMobile)`.
- `ManPageSection` — extract `ManPageDesktop` and `ManPageMobile` as separate RSC components.
- `getRedis()` — make singleton initialization atomic, preserving fail-open semantics on a Redis
  *construction* error, not only on a `.limit()` error.
- `InteractiveShell` — remove the no-op `useCallback(nextId, [])` wrapper.
- `Footer.client.tsx` — batch the dmesg boot sequence into a single coalesced state update.
- `MatrixRain` — stabilize color/speed props (or guard the effect) so the rAF loop is not
  cancelled and restarted on incidental parent re-renders.
- `/api/log` — make the smoke-prefix check case-insensitive.
- Clear the 11 pre-existing Biome warnings — fix `noStaticOnlyClass`, `noEmptyBlockStatements`,
  and `noNonNullAssertion`; suppress the 8 false-positive `noTemplateCurlyInString` with
  documented `biome-ignore` comments.
- Make `.husky/prepare-commit-msg` TTY-safe — guard the interactive (commitizen) path behind a
  TTY check so non-interactive commits do not emit a device error.

### CG9 — Docs & STANDARDS.md

- Write `STANDARDS.md` (11 chapters, §4).
- Rewire `CLAUDE.md`: replace the inline reference-standards section with a pointer to
  `STANDARDS.md`.
- Fix the domain: choose `erikunha.dev` as canonical; correct `CLAUDE.md`, `public/llms.txt`,
  `ARCHITECTURE.md`, and any other `.com.br` strings outside historical ADR text.
- ADR hygiene pass on `DECISIONS.md` — add SHAs to recent entries where recoverable; add an ADR
  entry for the standards supersession and for the D1/D2/D3 decisions.
- Retire or update stale doc content: `HANDOFF.md`;
  `docs/audit-2025-05.md` (mark superseded).
- `/api/erik.json` — bring it into the `defineHandler` envelope, or add `X-Request-Id` and a
  one-line documented exemption explaining why the SEO route stays bare JSON.

## 6. Resolved decisions (D1–D3)

- **D1 — `e2e-full` required:** split. Functional cross-browser specs required; `visual.spec.ts`
  remains a separate non-blocking job. Rationale: required where deterministic, advisory where
  pixel-fragile.
- **D2 — 43KB app-JS budget:** gate per-route First Load JS at a tightened threshold; track the
  43KB app-island figure as a documented design target via the bundle-analyzer artifact.
  Rationale: a stable real metric beats a fragile "app-only" gate that lies.
- **D3 — streaming refactor:** React-owned streaming node, `requestAnimationFrame`-coalesced
  updates, dedicated state. Rationale: React owns the DOM, renders stay frame-bounded, INP flat.

## 7. Risks & pre-mortem

| Risk | Mitigation |
|------|-----------|
| `e2e-full` visual specs are flaky cross-platform; promoting them to required would block all merges. | D1: only functional specs become required; visual stays non-blocking. |
| Test rewrite (~20 files) silently loses coverage. | One-for-one conversion; no deletion without a behavioral replacement; coverage captured before/after. |
| One large PR is hard to review. | Nine logically-grouped, individually-revertable commits; clear commit messages per group. |
| `@layer` introduction reorders specificity → visual regression. | Visual-regression suite is the safety net; baselines regenerated deliberately post-CG6. |
| Streaming refactor regresses INP. | D3: rAF-coalesced, dedicated state; INP verified via DevTools trace before/after. |
| Pinning deps to lockfile versions changes behavior. | Pinning to *already-installed* lockfile versions is behavior-neutral; full `pnpm verify` + build after. |
| CG1 caret ranges later resolve `next` to a new minor → `strip-next-polyfills.mjs` postinstall checksum guard fails. | Pin `next` tightly (or update the checksum in CG1's commit). A loud guard failure is correct behavior, not a regression. |

## 8. Testing strategy

- Each commit group keeps `pnpm verify` (lint + typecheck + content + client-naming + tests)
  green.
- CG3 is itself a test-quality change — coverage before/after is the acceptance signal.
- CG4 and CG6 are behavior/visual-affecting — INP trace (CG4) and visual-regression run (CG6) are
  required before the PR is marked ready.
- The full `pnpm ci` gate (verify + build + bundle-check) passes on the final branch.
- `pnpm ready-to-merge` passes before merge.
- Per the architect-reviewer spec gate, `performance-engineer` is dispatched after CG4 and CG6
  (INP / Lighthouse-affecting) and `accessibility-tester` after CG4 and CG6 (streaming + visual
  a11y), in addition to the standing `CLAUDE.md` agent dispatch table.

## 9. Out of scope

- Anything in `CLAUDE.md` "considered and rejected" (GraphQL, Tailwind re-add, CSS-in-JS, etc.).
- New product features or new portfolio sections.
- Re-litigating already-shipped audit-roadmap work that verification confirmed correct.
- Infrastructure changes (multi-region, alternate hosting).
- A doc-claim verifier script is a documented stretch goal in Chapter 10, not a committed
  deliverable.

## 10. Success criteria

1. `STANDARDS.md` exists, 11 domain chapters, every chapter naming its enforcement mechanism;
   `CLAUDE.md` points to it; `DECISIONS.md` records the supersession.
2. No dependency in `package.json` is `latest`/unbounded; `check-dep-pinning` gates CI.
3. `ci.yml` runs `check:client-naming` and `check:dep-pinning`; functional `e2e-full` specs are a
   required job; the bundle gate measures per-route First Load JS at a tightened threshold.
4. No `__tests__` file asserts application source via `readFileSync` without an allow-list tag;
   the behavioral-test meta-check enforces it; new behavioral tests cover the identified gaps.
5. `InteractiveShell` streaming renders through React; no out-of-tree DOM nodes; INP not
   regressed.
6. Every Tier 1/2/3 finding in §3 is resolved or has a documented, deliberate exemption.
7. `pnpm ci` and `pnpm ready-to-merge` pass on the final branch.
