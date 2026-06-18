# Onboarding Guide

> The "productive in days, not weeks" path. Follow it top to bottom. It assumes you've read nothing else.

## Day 0 - orient (≈1 hour)

1. Read [README.md](./README.md) (this knowledge base's index) and [02-domain.md](./02-domain.md). Now you know *what* the product is: a terminal-themed portfolio that's secretly a reference-architecture showcase, plus one AI feature.
2. Skim root **`ARCHITECTURE.md`** §0–§4 and §16 ("what I'd revisit"). This is the author's own narrative; treat it as canonical intent.
3. Skim root **`STANDARDS.md`** table of contents - note that *every chapter names its enforcement mechanism*. You won't memorize the rules; the gates will remind you.

## Day 1 - run it and read the spine

1. `pnpm install && pnpm dev`. Open `/`. Toggle the `MOTION` switch (top bar). Open `/design-system`. Hit `/api/healthz` and `/api/erik.json`.
2. Read these five files in order - they are the load-bearing spine:
   - `app/page.tsx` - the composition root (the whole RSC/PPR posture).
   - `components/responsive/Module/Module.tsx` - the section wrapper.
   - `content/schemas.ts` + one content module (e.g. `content/man-page.ts`) - how data is typed and validated.
   - `lib/server/route.ts` - the `defineHandler` API contract.
   - `lib/ask/system-prompt.ts` - how the AI persona is built from live content.
3. Read [01-architecture.md](./01-architecture.md) and [03-rendering-and-data-flow.md](./03-rendering-and-data-flow.md). You now understand how a request becomes pixels and how an action becomes a persisted effect.

## Day 2 - the conventions that will trip you

Read [09-hidden-knowledge.md](./09-hidden-knowledge.md) cover to cover. The four that matter most day-to-day:

- **Content goes in `content/*.ts`, never in JSX.**
- **Client files are `*.client.tsx`** (with the `components/client/**` caveat in F1).
- **No raw hex outside `theme.css`** - use `var(--color-*)`.
- **Never re-render React per keystroke/pixel/frame** - mutate the DOM or rAF-coalesce.

Then run `pnpm verify` once and read what each gate checks (doc 07). The gates *are* the onboarding: you can't merge something that violates a convention.

## Day 3 - make a safe first change

A good first PR (touches the common path, low blast radius):

1. **Edit a section's copy** - change a line in a `content/*.ts` module. `pnpm validate-content` proves the schema still holds. Add a `*.test.tsx` assertion if the shape changed.
2. **Or add a design-system component variant** - follow `Foo/Foo.tsx` + `Foo/index.ts`, co-locate a test, document it (`check:component-docs`), and run `pnpm dev` to eyeball it.
3. Commit with a conventional scope (`feat(content): ...`). Run `pnpm ready-for-pr`. Note that pushing triggers the **review battery + findings ledger + stamp** flow (doc 06) - for a real branch you'd run the 5-agent battery, record/resolve findings, then `pnpm review:stamp`.

> If your change touches `app/api/**`, `lib/rate-limit.ts`, or `proxy.ts`, the push is blocked until a `security-auditor` agent runs (`.claude/rules/api-boundary.md`). That's expected.

## Week 1 - go deep where you'll work

| If you'll work on... | Read | Then read the code |
|---|---|---|
| Sections / UI | [04-components-and-state.md](./04-components-and-state.md) | `components/sections/**`, `design-system/**` |
| The AI feature | [05-api-and-integrations.md](./05-api-and-integrations.md) §AI subsystem | `app/api/ask/route.ts`, `lib/ask/**`, `scripts/ask-eval.ts` |
| Performance | [08-performance-and-accessibility.md](./08-performance-and-accessibility.md) | `app/page.tsx` (PPR), `Module.tsx`, the islands |
| The dev platform / CI | [06-ai-development.md](./06-ai-development.md), [07-workflows.md](./07-workflows.md) | `.claude/**`, `scripts/check-*`, `.github/workflows/ci.yml` |
| Anything risky | [10-findings-and-debt.md](./10-findings-and-debt.md) | the relevant `DECISIONS.md` entry |

## The mental models to internalize

1. **Static by default; dynamic by exception.** If you're adding interactivity, you're adding a client island - justify the JS.
2. **The gate is the spec.** Don't argue with a red gate; reduce the property it measures.
3. **Everything fails open** (except the AI budget, which fails closed). Design new server code the same way.
4. **The architecture is the product.** A change isn't done when it works; it's done when it would survive a careful review of *how* it works.

## Who owns what (logical ownership)

Single-author repo, so "ownership" is by subsystem boundary, not by person:

| Subsystem | Boundary | Entry point |
|---|---|---|
| Page composition | `app/page.tsx` + `components/sections/**` | the section list in `page.tsx` |
| Content/domain | `content/**` | `content/schemas.ts` |
| Design system | `design-system/**` | `design-system/index.ts` |
| BFF / API | `app/api/**` + `lib/**` | `lib/server/route.ts` |
| AI feature | `app/api/ask` + `lib/ask/**` + eval | `lib/ask/model.ts` |
| Dev platform | `.claude/**` + `scripts/**` + `.github/**` | `CLAUDE.md` |

---

## Appendix - Future documentation roadmap

Prioritized by onboarding value. These would complete the knowledge base; they're enumerated here rather than written speculatively.

| Priority | Doc | Why |
|---|---|---|
| P0 | **Per-section feature guide** | one page per section: content shape, desktop/mobile variants, host islands, the `sec-*` id. Closes the biggest red-team gap (doc 10). |
| P0 | **Troubleshooting runbook** | expand doc 07's table into per-symptom runbooks (the 503 cascade, the stamp/push blocks, the cron). |
| P1 | **ADR cross-link index** | map code areas → relevant `DECISIONS.md` entries, so "why is this like this" is one hop from the file. |
| P1 | **Contributing guide** | the commit/scope/PR/review-battery workflow as a standalone CONTRIBUTING.md (currently spread across `CLAUDE.md`). |
| P1 | **AI Engineering guide** | deepen doc 06 into a standalone playbook for the eval harness + prompt-version + the guards (for anyone touching `/api/ask`). |
| P2 | **Mermaid diagram collection** | consolidate every diagram in this `/docs` set into one browsable file for architecture reviews. |
| P2 | **Frontend playbook** | the island/RSC decision tree, the INP rules, the CSS-token rules as a how-to. |
| P3 | **Accessibility & performance handbooks** | expand doc 08's two halves into standalone, testable checklists. |

### How this knowledge base was produced (provenance)

This `/docs` set was reverse-engineered from the code via five parallel discovery passes (routes/rendering, components/design-system, state/interactivity, content/data, lib/api/integrations), cross-checked against the canonical root docs. Where this set and the code disagree, the code is authoritative and the doc is a bug - file it. It is intentionally a **complement** to `ARCHITECTURE.md`/`STANDARDS.md`/`DECISIONS.md`, not a replacement: those remain the source of intent; this set is the navigable, diagram-first map.
