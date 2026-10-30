# Onboarding Guide

> A path through the application, its source and its checks.

## Day 0 - orient (≈1 hour)

1. Read [README.md](./README.md) (this knowledge base's index) and [02-domain.md](./02-domain.md). Now you know _what_ the product is: a terminal-themed portfolio with reference documentation, plus one AI feature.
2. Skim root **`ARCHITECTURE.md`** for the application structure and server boundaries.
3. Skim root **`STANDARDS.md`** table of contents - note that _every chapter names its enforcement mechanism_. You won't memorize the rules; the gates will remind you.

## Day 1 - run it and read the spine

1. `pnpm install && pnpm dev`. Open `/`. Toggle the `MOTION` switch (top bar). Open `/design-system`. Hit `/api/healthz` and `/api/erik.json`.
2. Read these five files in order - they are the load-bearing spine:
   - `app/page.tsx` - the terminal home composition; then inspect `/summary`, `/cv`, `/links` and `/links/en`.
   - `components/responsive/Module/Module.tsx` - the section wrapper.
   - `content/schemas.ts` + one content module (e.g. `content/man-page.ts`) - how data is typed and validated.
   - `lib/server/route.ts` - the `defineHandler` API contract.
   - `lib/ask/system-prompt.ts` - how the AI persona is built from live content.
3. Read [01-architecture.md](./01-architecture.md) and [03-rendering-and-data-flow.md](./03-rendering-and-data-flow.md). You now understand how a request becomes pixels and how an action becomes a persisted effect.

## Day 2 - the conventions that will trip you

Read [09-hidden-knowledge.md](./09-hidden-knowledge.md) cover to cover. The four that matter most day-to-day:
- **Keep shared section data in `content/*.ts`; inspect validation and client imports when editing it.**
- **Client naming uses `*.client.*`, a `/client/` directory, or an App Router error filename.**
- **No raw hex outside `theme.css`** - use `var(--color-*)`.
- **Animation islands mutate the DOM; shell streaming coalesces React state updates with requestAnimationFrame.**

Then run `pnpm verify` once and read what each gate checks (doc 07). The checks show which properties are enforced. Read project policy separately for review and merge conventions.

## Day 3 - make a safe first change

A good first PR (touches the common path, low blast radius):
1. **Edit a section's copy** - change a line in a `content/*.ts` module. `pnpm validate-content` proves the schema still holds. Add a `*.test.tsx` assertion if the shape changed.
2. **Or add a design-system component variant** - follow `Foo/Foo.tsx` + `Foo/index.ts`, co-locate a test, document it (`check:component-docs`), and run `pnpm dev` to eyeball it.
3. Commit with a conventional scope (`feat(content): ...`). Run `pnpm ci:local` and `pnpm gates:runtime`. Note that pushing runs `.husky/pre-push`: main-push guard, branch-name guard, and the full `pnpm verify` chain.

For `app/api/**`, `lib/rate-limit.ts` or `proxy.ts` changes, follow the security-review convention in `.claude/rules/api-boundary.md`. No project agent hook blocks pushes on that review.

## Week 1 - go deep where you'll work

| If you'll work on...  | Read                                                                                 | Then read the code                                          |
| --------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Sections / UI         | [04-components-and-state.md](./04-components-and-state.md)                           | `components/sections/**`, `design-system/**`                |
| The AI feature        | [05-api-and-integrations.md](./05-api-and-integrations.md) §AI subsystem             | `app/api/ask/route.ts`, `lib/ask/**`, `scripts/ask-eval.ts` |
| Performance           | [08-performance-and-accessibility.md](./08-performance-and-accessibility.md)         | `app/page.tsx` (PPR), `Module.tsx`, the islands             |
| The dev platform / CI | [06-ai-development.md](./06-ai-development.md), [07-workflows.md](./07-workflows.md) | `.claude/**`, `scripts/check-*`, `.github/workflows/ci.yml` |
| Anything risky        | [10-findings-and-debt.md](./10-findings-and-debt.md)                                 | the relevant `DECISIONS.md` entry                           |

## The mental models to internalize

1. **Static by default; dynamic by exception.** If you're adding interactivity, you're adding a client island - justify the JS.
2. **The gate is the spec.** Don't argue with a red gate; reduce the property it measures.
3. **Failure behavior follows the operation.** Rate limits and dedup fail open; ask budget and contact persistence fail closed.
4. **The architecture is the product.** A change isn't done when it works; it's done when it would survive a careful review of _how_ it works.

## Who owns what (logical ownership)

Single-author repo, so "ownership" is by subsystem boundary, not by person:

| Subsystem        | Boundary                                   | Entry point                    |
| ---------------- | ------------------------------------------ | ------------------------------ |
| Page composition | `app/page.tsx` + `components/sections/**`  | the section list in `page.tsx` |
| Content/domain   | `content/**`                               | `content/schemas.ts`           |
| Design system    | `design-system/**`                         | `design-system/index.ts`       |
| BFF / API        | `app/api/**` + `lib/**`                    | `lib/server/route.ts`          |
| AI feature       | `app/api/ask` + `lib/ask/**` + eval        | `lib/ask/model.ts`             |
| Dev platform     | `.claude/**` + `scripts/**` + `.github/**` | `CLAUDE.md`                    |
