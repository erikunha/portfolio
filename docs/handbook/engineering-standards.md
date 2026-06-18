# Engineering Standards

> The explicit standards index, and the gate that enforces each. The canonical source is root `STANDARDS.md` (12 chapters, each naming its enforcement). This doc routes to it and surfaces the standards that are otherwise implicit. The principle: a standard with no enforcement is marked as such; most have a mechanical gate.

## The standards-to-gate map

| Domain | Standard (summary) | Enforced by |
|---|---|---|
| 1. Rendering & Architecture | RSC/SSG default; client code is the exception and named `*.client.tsx`; the Matrix loop uses `textContent` mutation, the shell streams through React | `check:client-naming`; behavioral tests |
| 2. API & Server Boundary | `defineHandler` envelope; fixed `rate-limit -> parse -> validate -> handle` order | `defineHandler` + behavioral tests + e2e |
| 3. Performance | LHCI budgets (perf >=95, LCP <1.8s, CLS <0.05, ...); gzipped chunks <=220KB | Lighthouse CI; `bundle-check` |
| 4. Testing | behavioral assertions only; no source-grep tests | `no-source-grep.test.ts` |
| 5. Dependencies | no `latest`/`*`/tags; frozen lockfile in CI | `check:dep-pinning`; `--frozen-lockfile` |
| 6. Content & Type Safety | content is typed TS validated by Zod at build; no copy in JSX | `validate-content` |
| 7. CSS & Visual System | `@theme` tokens only; no raw hex outside `theme.css`; complex patterns as named classes | `lint:css-tokens`; `lint:contrast` |
| 8. Accessibility | WCAG 2.1 AA; Lighthouse a11y = 100; zero axe violations | axe-core gate; Lighthouse; per-component a11y tests |
| 9. Security & Privacy | CSP + kill switches; `security-auditor` on any API edit | behavioral tests; api-edit hooks |
| 10. Documentation & Decisions | doc claims match live code; ADRs cite SHA + reversibility | PR review; `check:doc-drift` |
| 11. Developer Experience | pre-commit Biome; pre-push verify; branch-name + scope enforced; never disable a gate to merge | husky + commitlint |
| 12. Design System | token boundary + component-docs gates | `lint:contrast`; `check:component-docs` |

Read the full rationale in `STANDARDS.md`; load a chapter when it is directly relevant.

## Implicit standards made explicit

These are not in a single chapter but are consistently enforced by practice and gates:

- **Naming.** `Foo/Foo.tsx` + `Foo/index.ts` per component; `*.client.tsx` for client code; `*Lazy` for dynamic-import wrappers; `*Desktop/*Mobile` for dual-variant RSC; `_components`/`_lib` for route-private; `sec-*` ids for sections. (See [`/docs/09`](../09-hidden-knowledge.md) for the full map.)
- **Commit hygiene.** Conventional Commits with a mandatory feature-area scope; commit in scope blocks (one logical unit per commit); `(design-system)` commits regenerate the changelog.
- **The four-conditions rule for any fix.** Root cause stated, pattern scan complete, no deferred debt, measured property verified (cite before/after).
- **Smallest reasonable change.** Never rewrite a working implementation without explicit permission; never change unrelated code in the same commit.
- **Reversibility.** Every architectural decision gets an ADR with a "how to undo" note.
- **AI usage.** The agent must use the mandated skills (brainstorming before features, TDD before implementation, systematic-debugging on bugs, verification-before-completion before claiming done). The review battery runs before every push.
- **The gate is the spec.** A red gate is fixed by reducing the measured property, never by disabling the gate or lowering a threshold. Acceptable gate-config changes are limited to correcting a genuinely-miswritten assertion.

## Performance and accessibility as standing constraints

Performance, accessibility, and security are explicitly "implicit on every change, not separate phases" (`CLAUDE.md`). In practice: a visual change regenerates baselines before a PR; a new interactive element passes the a11y tester; a change that could move a Core Web Vital gets a performance-engineer pass. The budgets are in [`/docs/08`](../08-performance-and-accessibility.md).

## What "no enforcement" looks like

A few standards are honor-system by acknowledgment, and they are labeled as such rather than pretended to be enforced. The clearest example is the review loop's residual boundary: the stamp mechanically proves a finding was *resolved*, but *recording* a finding honestly is still on the operator (the stamp cannot know about a finding nobody recorded). Naming these boundaries explicitly is itself a standard.
