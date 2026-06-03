# Engineering Standards — erikunha.dev

> The canonical engineering bar for this repository. Supersedes the inline
> "Reference standards" list previously in CLAUDE.md. Every standard below
> names how it is enforced — a CI gate, a review checklist item, or culture.
> A rule with no enforcement is marked as such, deliberately.

This portfolio is itself the hiring pitch: code quality, architecture, perf
budgets, and accessibility are the product, not afterthoughts. The eleven
chapters below are organized by domain. Each states the **rule**, the
**rationale**, and **how it is held** — the concrete mechanism that keeps the
rule true on every PR. Where a rule is held by culture rather than a gate, the
chapter says so plainly; an aspirational rule with no enforcement is a lie, and
this document does not tell them.

---

## 1. Rendering & Architecture

**Rule.** React Server Components are the default. Every section renders on the
server, statically generated at build time, shipping zero JavaScript unless it
genuinely needs the client. Client islands exist by exception only — the Matrix
dialog loop, the interactive shell, the contact form, the IntersectionObserver
typewriter, the motion indicator, the Matrix rain. Every file that carries
`'use client'` is named `*.client.tsx` (or lives under a `/client/` directory);
no `.client.tsx` file exports an `async function`. The root route is
`force-static` unless an ADR in `DECISIONS.md` justifies going dynamic. The
interactive shell's streaming answer renders *through* React — no out-of-tree
DOM nodes, no `document.createElement` + `appendChild` into a React-owned feed,
no per-chunk `textContent` mutation inside an `aria-live` region React controls.

**Rationale.** RSC-default is the single largest lever on the JS budget: static
sections cost nothing on the wire. The client boundary must be *visible* in
review — a `.client.tsx` rename forces the author to acknowledge they are
shipping JavaScript. Out-of-tree DOM mutation inside a React-owned subtree is a
reconciliation hazard: React can clobber the manually-inserted node on its next
render, and a screen reader on the `aria-live` region observes mutations React
never announced. Streaming through React state — coalesced one update per
animation frame — keeps the DOM React-owned and INP frame-bounded.

**How it is held.** Mechanical gate: `scripts/check-client-naming.mjs`
(`pnpm check:client-naming`) runs in the `build-and-gate` CI job and in the
`pre-push` hook — it fails the build if any `'use client'` file is misnamed or
exports `async function`. The streaming-through-React contract is held by the
behavioral test `components/client/InteractiveShell/InteractiveShell.test.tsx`, which asserts
every child of the shell feed is a React-owned node (`__reactFiber$` key
present). `force-static` on the root route is held by PR review against this
chapter.

---

## 2. API & Server Boundary

**Rule.** Every JSON `/api/*` route returns one envelope:
`{ ok: true, requestId, data? }` on success, or
`{ ok: false, requestId, error: { code, message, issues? } }` on failure, with
an `X-Request-Id` header on every response. The processing order is fixed:
`rate-limit → parse → validate → handle`. This is centralized in
`lib/server/route.ts` (`defineHandler`); routes own only their side effects and
business logic. Every outbound external call (Anthropic, Resend, Redis) carries
an explicit timeout — including a mid-stream watchdog on `/api/ask`, not only a
connection-initiation timeout. Fail-open versus fail-closed is a deliberate,
documented choice per control: rate-limiting and the Redis singleton fail
*open* (a Redis outage must not take the site down); the budget cap fails
*closed* (cost safety is non-negotiable).

**Documented exemption.** `/api/erik.json` is intentionally *outside* the
envelope. It is a machine-readable resume *document*, not an *operation* —
agent crawlers and recruiters fetch it expecting a plain JSON profile, and
wrapping it in `{ ok, requestId, data }` would break those consumers. It
therefore stays bare JSON. Being `force-static`, it has no per-request
handling, so it deliberately emits no `X-Request-Id` — a static route can only
mint a build-time constant, and a constant request id is observability theater
(see Ch. 9). The route file carries a comment recording this exemption. The streaming `/api/ask` route is likewise not refactored
onto `defineHandler` — its response shape is intrinsically a token stream, not
an envelope — but it still mints and exposes a request id.

**Rationale.** One envelope means the client tells success from failure without
per-route shape-switching, and every error is correlatable by `requestId`
across logs and the GDPR erasure flow. The fixed order means a jailbreak or
abuse attempt is rejected *before* it consumes quota or reaches an upstream. An
explicit timeout on every external call means a hung dependency degrades to a
structured error instead of an open connection.

**How it is held.** Behavioral tests: `__tests__/route-handler.test.ts`
exercises `defineHandler` and asserts the envelope shape, the `X-Request-Id`
header, and the `rate-limit → parse → validate → handle` ordering by observable
behavior (not source inspection). `components/client/ContactForm/ContactForm.test.tsx`,
`__tests__/api-log-shape.test.ts`, and the `/api/ask` test suite assert the
envelope and error paths per route. The `erik.json` exemption is documented in
its route file and here. The full surface is also covered by the required
`e2e-functional` CI job (`components/client/ContactForm/ContactForm.e2e.ts`,
`components/client/InteractiveShell/InteractiveShell.e2e.ts`,
`observability-smoke.spec.ts`).

---

## 3. Performance

**Rule.** The non-negotiable budgets: LCP < 1.8s on 4G, INP < 200ms, CLS < 0.05.
Lighthouse must score Performance ≥ 95, Accessibility = 100, Best Practices ≥ 95,
SEO = 100. Budgets are measured in the smallest *honest* unit. The client-chunk
total is gated as a coarse ceiling; the 43KB app-island JS figure is a *design
target*, tracked — not gated by a fragile "app-only" extraction that would lie.
Any route that calls `headers()` / `cookies()` / `force-dynamic` and thereby
opts out of static generation requires an ADR entry in `DECISIONS.md`
justifying the cost.

**Rationale.** A portfolio that is itself a Staff/Principal hiring artifact must
demonstrate the budgets it claims to enforce. The honesty clause matters: a
bundle gate set to a framework-inclusive number while a comment claims it
measures app-only JS is *theater* — it passes while telling a falsehood. The
gate measures what it can measure truthfully (total client chunks); the
aspirational app-island figure is tracked via the analyzer artifact and stated
as a target, not dressed up as a gate.

**How it is held.** Mechanical gates: Lighthouse CI runs in `build-and-gate`
for both desktop (`pnpm lhci`) and mobile (`pnpm lhci:mobile`) and fails the
build on any category dropping below threshold. `scripts/check-bundle-size.mjs`
(`pnpm bundle-check`) gates the gzipped client-chunk total in CI; its header
comment honestly describes what the number is — the framework-inclusive total,
not the 43KB design target. App-island JS is inspected via
`pnpm bundle:analyze` (`@next/bundle-analyzer`), an artifact, not a gate. The
`force-dynamic` ADR rule is held by PR review against this chapter.

---

## 4. Testing

**Rule.** Tests assert *behavior*, not *source*. A test must exercise observable
output — render the component and inspect the DOM, call the handler and inspect
the response, trigger the side effect and assert it happened. Reading
application source under `app/`, `components/`, `lib/`, or `scripts/` with
`readFileSync` to make a structural assertion (`.toContain`, `.toMatch` on file
text) is banned. The one permitted exception is a `readFileSync` carrying an
explicit `// behavioral-test-allow: <reason>` tag — used where the file itself
*is* the artifact under test and the unit layer has no behavioral substitute: a
config/manifest read (e.g. asserting an installed dependency version from
`package.json`), or a built CSS asset whose effect (`content-visibility`,
`@keyframes`, `:focus-visible`) jsdom cannot evaluate. The tag forces the reason
to be stated and reviewed; an untagged source read fails the gate. Every API route, every kill switch, and every interactive client component
has a behavioral test. The functional cross-browser e2e specs are a *required*
CI job; no test is deleted without a behavioral replacement.

**Rationale.** A source-grep test gives false confidence: it passes if the
matched symbol appears in a comment or a dead branch, and it fails on an
innocuous rename even when behavior is unchanged. It tests the *shape of the
text*, not the *correctness of the program*. Behavioral tests fail when, and
only when, the guarantee actually regresses.

**How it is held.** Mechanical gate: the meta-check
`__tests__/meta/no-source-grep.test.ts` walks every `*.test.ts` file and fails
if one reads application source via `readFileSync` without the allow tag — it
runs as part of `pnpm test` inside `pnpm verify` and CI. Kill switches and CSP
are covered by behavioral tests (`__tests__/ask-killswitch-behavioral.test.ts`,
`__tests__/proxy-csp.test.ts`) — no kill switch is verified by grepping source.
Cross-browser functional coverage is the **required** `e2e-functional` CI job
(chromium, chromium-mobile, webkit-desktop, webkit-mobile, chromium-components). Visual regression
is split across two jobs: `e2e-visual-chromium` is **required** (Linux Chromium rendering is
deterministic); `e2e-visual-webkit` is **non-required** (webkit pixel rendering varies from
Chromium baselines and must not block merges).

---

## 5. Reproducibility & Dependencies

**Rule.** Every dependency in `package.json` — `dependencies` and
`devDependencies` alike — is pinned to a major-locked range (`^x.y.z`, or `~x.y.z`
where a minor bump would break a build-time invariant). Never `latest`, never
`*`, never a bare dist-tag. `next` is pinned tightly enough (a tilde range) that
a fresh install cannot resolve a new minor and break the `postinstall`
polyfill-strip checksum. The lockfile (`pnpm-lock.yaml`) is the source of truth;
CI installs with `--frozen-lockfile`. `zod` is exact-pinned — its minor bumps
break type inference.

**Rationale.** `latest` means a fresh `pnpm install` on a clean machine can jump
a major version and silently change behavior; `--frozen-lockfile` only masks the
drift until the lockfile is regenerated. Major-locking every dependency makes
the build reproducible across machines and across time — a property a Staff-bar
artifact must demonstrate, not merely claim. The tilde on `next` exists because
`scripts/strip-next-polyfills.mjs` verifies a checksum of a Next-internal file
and fails *loud* on mismatch; a caret range could float `next` onto a new minor
and trip that guard on an otherwise-clean install.

**How it is held.** Mechanical gate: `scripts/check-dep-pinning.mjs`
(`pnpm check:dep-pinning`) rejects any `latest`, `*`, wildcard, or otherwise
unbounded spec. It runs inside `pnpm verify`, in the `pre-push` hook, and as the
`Dependency-pinning gate` step in the `build-and-gate` CI job. Reproducibility
of the install itself is held by `pnpm install --frozen-lockfile` in CI.

---

## 6. Content & Type Safety

**Rule.** All user-facing content lives in `content/*.ts` as typed TypeScript
modules, validated by Zod schemas (`content/schemas.ts`) at build time — the
build fails on any schema violation. Schemas are *tight*: every user-facing
label, heading, and text field is `.min(1)` (an empty string is a content
defect, and a defect must fail the build, not render blank); closed-set fields
use enums over free strings; URL and email fields use `.url()` / `.email()`. No
user-facing copy is inlined in `.tsx` — if copy is being typed into a component,
it belongs in `content/` instead.

**Rationale.** Content-in-TS gives the type system and Zod a chance to catch a
typo or a missing field before it ships. A loose `z.string()` on a heading lets
an empty string through silently; `.min(1)` turns that silent blank into a build
failure. Keeping copy out of JSX keeps the content layer the single source of
truth and keeps components purely presentational.

**How it is held.** Mechanical gate: `pnpm validate-content`
(`scripts/validate-content.ts`) runs every content module through its Zod schema
and exits non-zero on any violation. It runs inside `pnpm verify`, in the
`pre-push` hook, and as the `Validate content` step in the `build-and-gate` CI
job. The "no copy in `.tsx`" rule is held by PR review against this chapter.

---

## 7. CSS & Visual System

**Rule.** All brand colors and font definitions live in `app/css/theme.css` under a single `@theme {}` block — these become Tailwind utility classes (`text-signal`, `bg-surface`, `border-signal-subtle`, etc.). Standard Tailwind utilities handle all spacing, typography, layout, and responsive breakpoints. Complex CSS that cannot be expressed as utilities — CRT scanlines, phosphor glow, `@keyframes`, pseudo-element overlays — lives in `app/css/components.css` under `@layer components` as named classes (`.crt-scanlines`, `.signal-glow`, `.boot-cursor`). No CSS module files exist anywhere in the project. The palette is two semantic roles: `--color-signal` (#00FF41) for headings/accents/large text only; `--color-text-body` (#E6FFE6, ~13:1 contrast) for body. `--color-signal` is never used for paragraph text — it fails WCAG AA at body size. 1px borders, sharp corners.

**Rationale.** Tailwind v4 eliminates the authoring friction of typing raw `@media (max-width: 768px)` literals at every responsive override site. `md:` and `lg:` prefixes encode the breakpoint contract directly in the markup, colocated with the layout intent. `@theme` is the superior reference-system artifact: it is the current industry standard for design tokens in Next.js projects, readable by any senior frontend reviewer, and enforced by the same single-source-of-truth discipline the old Style Dictionary provided — without the build pipeline. PostCSS returns to the stack exclusively as the `@tailwindcss/postcss` plugin; no other PostCSS transformations are applied.

**How it is held.** `scripts/contrast-check.mjs` audits every documented text/surface pair against WCAG AA ratios; values are hardcoded from `@theme` (update both when the palette changes). CSS modules are allowed for components with complex styling needs that utilities cannot express. Visual regression (`tests/visual/visual.spec.ts`) catches any layout shift from CSS changes. The `ui-ux-tester` agent dispatches on CSS/layout changes. ADR entries for CSS system changes live in `DECISIONS.md`.

**Co-authoring rule — where new CSS goes:** Tailwind utilities in JSX `className` handle all spacing, color, layout, typography, and responsive breakpoints. A named class in `@layer components` is required (not optional) when a pattern needs any of the following: `@keyframes` or `animation:`, pseudo-element overlays (`::before`/`::after`), `mix-blend-mode`, simultaneous coordination of 5+ CSS declarations on one element, or a CSS custom property local variable (`--var: value`). Everything else is a Tailwind utility. When in doubt: if it can be expressed as 1-4 utility classes, it stays in JSX. Files: `crt.css` for CRT overlay effects, `animations.css` for `@keyframes`-heavy section animations, `components.css` for everything else.

---

## 8. Accessibility

**Rule.** WCAG 2.1 AA across the whole site. Lighthouse Accessibility scores
exactly 100. Every interactive client component has a behavioral accessibility
test asserting tab order, focus visibility, keyboard activation, and screen-
reader announcement. Streaming UI emits discrete DOM nodes per chunk that React
owns — never a `textContent` mutation on a shared node inside an `aria-live`
region. All CRT motion effects are disabled under `prefers-reduced-motion: reduce`.

**Rationale.** A11y is a unit test, not a final-phase audit: a regression in tab
order or a missing `role="alert"` is a behavior change and should fail like any
other behavior change. The streaming-node rule is both a performance and an a11y
constraint — a shared mutated node makes the `aria-live` region announce
unpredictably; discrete React-owned nodes announce cleanly.

**How it is held.** Mechanical gates: the axe-core scan (`tests/a11y/axe.spec.ts`,
the `axe-core a11y scan` step in `build-and-gate`) fails the build on any axe
violation; Lighthouse CI gates the Accessibility category at 100 (Chapter 3).
Per-component behavioral a11y tests — for example
`components/client/ContactForm/ContactForm.test.tsx` (tab order, `role`/`aria-live` error
region, keyboard-activatable submit) and `components/client/InteractiveShell/InteractiveShell.test.tsx` — run
inside `pnpm test`. `prefers-reduced-motion` coverage is exercised by the
`cross-cutting.spec.ts` e2e spec in the required `e2e-functional` job.

---

## 9. Security & Privacy

**Rule.** No dead-code security theater: every CSP directive has a real
consumer or is deleted; every cache directive verifiably activates; every kill
switch has a *behavioral* test, not a source-grep. PII is minimized — no
personal phone number, no private contact channel, in any machine-fetchable
surface. The `/api/ask` SYSTEM prompt and the public `erik.json` profile carry
email only. Prompt-injection defense is layered: a per-request 128-bit sentinel
wrapper is the primary guard, `INJECTION_RE` (covering role tokens, override
phrases, and `<|...|>` ChatML-style delimiters) is defense-in-depth, and the
`<question>` delimiter wrapping tells the model the input is data. The Anthropic
budget cap fails *closed*.

**Rationale.** A CSP directive with no consumer, or a kill switch verified only
by grepping its symbol name, is *theater* — it looks like a control and
enforces nothing. A control is real only when a behavioral test proves it
activates. PII minimization matters because `/api/ask` and `/api/erik.json` are
deliberately public and crawlable; a phone number baked into the SYSTEM prompt
is a privacy leak on a fetchable surface.

**How it is held.** Mechanical: the CSP posture is held by the behavioral test
`__tests__/proxy-csp.test.ts` (asserts the header is present and shaped
correctly on responses); the `/api/ask` kill switch is held by
`__tests__/ask-killswitch-behavioral.test.ts` (calls the route with each
off-keyword and asserts the dependencies that should *not* run were not
called); the SYSTEM prompt is held by `__tests__/system-prompt.test.ts` (asserts
no phone-number pattern, asserts the 1024-token cache threshold still clears).
The "no dead CSP directive" and "PII minimization" rules are also enforced by
PR review and the `security-auditor` dispatch on any `app/api/` change.

---

## 10. Documentation & Decisions

**Rule.** Every file, function, and numeric budget named in `ARCHITECTURE.md`
must be verifiable against the live code — a doc claim that no longer matches
the codebase is a defect. ADR entries in `DECISIONS.md` cite the commit SHA they
ship in, and carry a one-line reversibility note. There is one canonical
production domain — `erikunha.dev` — used consistently across every
current-state file; historical dated ADR text and superseded specs keep their
original wording (they record history, and history is not edited). Superseded
documents carry a header banner pointing at what replaced them.

**Rationale.** Documentation that drifts from code is worse than no
documentation — a reader trusts it and is misled. A portfolio that is a hiring
artifact cannot ship an `ARCHITECTURE.md` that describes a system that no longer
exists. SHA-anchored ADRs make a decision auditable and a revert precise. One
canonical domain removes the `erikunha.com.br` / `erikunha.dev` ambiguity the
audit flagged (`robots.txt`, `sitemap.ts`, and `layout.tsx` `metadataBase` all
ship `.dev`).

**How it is held.** PR review against this chapter is the primary mechanism: the
reviewer checks that doc claims still match code and that any new ADR cites its
SHA and reversibility note. A doc-claim verifier script — a `scripts/audit/`
tool that mechanically checks every file/function/budget named in
`ARCHITECTURE.md` — is a documented *stretch goal*, not a shipped gate; this
chapter states that plainly so the absence is not mistaken for a silent
aspiration. Superseded docs (`docs/audit-2025-05.md`,
`docs/audit/2026-05-19-principal-audit.md`) carry an explicit historical
banner.

---

## 11. Developer Experience

**Rule.** The pre-commit hook is sub-second — it runs only `pnpm check` (Biome
lint + format). The heavier gate runs in `pre-push`: typecheck,
`validate-content`, `check:client-naming`, `check:dep-pinning`, and the unit
tests. `pnpm verify` is the named, single pre-PR command that runs the full
local gate. CI gates are never disabled to merge — a failing gate means the
underlying issue is fixed, not the gate removed. Every dependency is installed
at the pinned range and `pnpm` is the only package manager.

**Rationale.** DX is measured in seconds per commit. A heavy per-commit hook
taxes every iteration and trains the developer to `--no-verify`; a sub-second
pre-commit plus a once-per-push heavy gate keeps the same safety net at a
fraction of the friction. "Never disable a gate to merge" is the load-bearing
cultural rule of the whole document — a gate that can be switched off under
deadline pressure enforces nothing.

**How it is held.** Mechanical: the two-tier hook strategy is enforced by the
git hooks themselves — `.husky/pre-commit` runs `pnpm check`, `.husky/pre-push`
runs the branch-name guard plus `pnpm verify`. `pnpm verify` is defined in
`package.json` as the composed chain (`check + typecheck + validate-content +
check:client-naming + check:dep-pinning + test`). The "never disable a gate"
rule is held by **culture** and by PR review — there is no meta-gate that can
prevent a gate from being deleted, only the standard that says it must not be.
The PR merge gate (`pnpm ready-to-merge`, GitHub `required_conversation_resolution`
branch protection) is the human-in-the-loop backstop.

---

## 12. Design System

**Rule.** Brand design tokens (colors, glow stops, font families) are authored in `app/css/theme.css` under `@theme {}` — the single source of truth consumed by Tailwind's utility-class generator at build time. Standard Tailwind scale handles spacing (`p-4`, `gap-5`), typography (`text-sm`, `text-base`), z-index (`z-10`, `z-50`), and duration (`duration-200`). The `design-system/tokens/*.json` JSON source files are retained as documentation artifacts — they are NOT consumed at build time. Every primitive component lives under `design-system/components/<Name>/` with `.tsx`, `.test.tsx`, `index.ts`, and a corresponding MDX docs page under `app/design-system/`. Components use Tailwind utilities directly; no `.module.css` files exist. Complex per-component visual patterns that cannot be expressed as utilities (pseudo-elements, `@keyframes`, complex box-shadow stacks) are added to `app/css/components.css` under `@layer components` as named classes and referenced by plain className strings. Every semantic text/surface pair is audited for WCAG AA contrast in CI (`scripts/contrast-check.mjs`).

**Rationale.** Tailwind `@theme` replaces Style Dictionary as the design token source with zero build pipeline overhead — same single-source-of-truth discipline, immediately recognisable to any senior reviewer, and live-verified by TypeScript autocomplete on every utility class. The JSON token files are retained because they encode the palette structure and semantic intent legibly for documentation and human review; they are just not the build-time source of truth anymore.

**How it is held.** CI gates: (1) `scripts/contrast-check.mjs` audits semantic pairs against WCAG AA, (2) `pnpm bundle-check` gates JS bundle size per route, (3) `check:component-docs-coverage` fails if a primitive component lacks a `## ComponentName` heading in `app/design-system/components/page.mdx`. CSS modules are allowed when a component needs them. Visual regression covers every primitive component. The `architect-reviewer` agent runs against any spec touching the design system before `writing-plans`. ADR entries for design-system changes live in `DECISIONS.md`.

---

## Provenance

This document supersedes the inline "Reference standards (post-audit
2026-05-19)" list formerly in `CLAUDE.md`. It was produced as deliverable 1 of
the Reference Standards & Improvement Program — see
`docs/superpowers/specs/2026-05-20-reference-standards-and-improvement-program-design.md`
for the design rationale and `DECISIONS.md` for the ADR entry recording the
supersession. Every gate named in Chapters 1–11 was verified present in the
repository at the time of writing; a citation to a gate that does not exist is
itself a violation of Chapter 10. Chapter 12 is explicitly forward-declared
(gates land in PRs A–E of the design system tokenized spec) and is exempt from
this verification requirement until those PRs merge.
