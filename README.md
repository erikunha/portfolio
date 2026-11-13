# erikunha.dev

**Erik Cunha — Senior Software Engineer, AI Engineer.** 8+ years of production software across AI-native SaaS, fintech, payments and e-commerce, and open to Senior, AI Engineer, Applied AI Engineer, AI Product Engineer and Founding Engineer roles.

The site is the artifact: a Next.js 16 application on Vercel (Fluid Compute), an RSC-first homepage composed of terminal-module sections plus a footer with client islands by exception, a streaming LLM endpoint, a durable contact form, and a CI pipeline that enforces performance, accessibility and bundle size as hard contracts — the Lighthouse thresholds and the axe scan in the `performance` job, the client-chunk and per-route JS budgets in the `build` job.

**Live:** [erikunha.dev](https://www.erikunha.dev)

<p>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs&logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" />
  <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-Fluid_Compute-000?logo=vercel&logoColor=white" />
  <img alt="pnpm 10" src="https://img.shields.io/badge/pnpm-10+-F69220?logo=pnpm&logoColor=white" />
  <img alt="Node 22" src="https://img.shields.io/badge/Node-22.22.2+-417E38?logo=nodedotjs&logoColor=white" />
  <img alt="Biome" src="https://img.shields.io/badge/Biome-lint%20%2B%20format-60A5FA?logo=biome&logoColor=white" />
  <img alt="Vitest" src="https://img.shields.io/badge/Vitest-unit-6E9F18?logo=vitest&logoColor=white" />
  <img alt="Playwright" src="https://img.shields.io/badge/Playwright-E2E%20%2B%20a11y-2EAD33?logo=playwright&logoColor=white" />
  <img alt="Lighthouse CI" src="https://img.shields.io/badge/Lighthouse-CI%20gates-F44B21?logo=lighthouse&logoColor=white" />
  <img alt="Anthropic" src="https://img.shields.io/badge/Anthropic-Haiku%205.5-D97757?logo=anthropic&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/code-MIT-blue" />
</p>

---

The codebase demonstrates the engineering it claims: "performance-first" is a budget and not an adjective — Lighthouse CI gates the category scores and the timings on the 24 routes the Lighthouse config lists, the axe scan fails CI, and the client-chunk and per-route first-load JS budgets are gates in the `build` job (`check-bundle-size.mjs` and `check-route-js.mjs`). `ARCHITECTURE.md` describes the system; `DECISIONS.md` records decisions and reversibility notes.

The AI centerpiece is a streaming `ask` endpoint (Vercel AI Gateway + Anthropic Haiku 5.5, prompt-cached, rate-limited, budget-capped) with a correctness eval suite and a visible metrics panel, making AI quality observable to hiring reviewers. Agent-readiness surfaces include `/.well-known/agent.json` and a minimal MCP server.

The terminal homepage is complemented by `/summary`, `/cv`, `/links` (pt-BR), `/links/en`, the pt-BR twins `/pt`, `/pt/cv` and `/pt/summary`, and 18 `/design-system` documentation pages (overview, tokens, components, enforcement, changelog, three foundations and ten primitives). Every page, the 404 pages and the route error pages included, renders through one shell: the same topbar, site menu, dock and position line. The English and pt-BR routes live in two route groups, each with its own root layout and `<html lang>`.

---

## Stack

| Technology                              | Purpose                                                                                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js 16 (App Router)                 | RSC-first static generation with selective client islands                                                                                                 |
| React 19                                | Server components + streaming hydration                                                                                                                   |
| TypeScript strict                       | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; `pnpm typecheck` runs the native compiler preview (`tsgo`)                                      |
| Vercel AI Gateway + Anthropic Haiku 5.5 | Streaming `/api/ask` with prompt caching and cost tracking                                                                                                |
| Upstash Redis                           | Rate limiting, budget cap, KV interaction log                                                                                                             |
| Tailwind v4 (via PostCSS)               | Utility-first styling; design tokens authored in `app/css/theme.css` under `@theme {}`. No CSS Modules, no Style Dictionary, no build-time token pipeline |
| Design system (`/design-system`)        | 11 components (10 server-compatible; Field is client), docs CopyButton helper, `@theme` tokens and live docs                                               |
| Biome                                   | Lint + format in a single Rust binary                                                                                                                     |
| Vitest + Playwright                     | Unit (80% lines, 70% branches) + E2E across eight Playwright projects + axe-core a11y CI suite + Argos visual diffs                                    |
| Lighthouse CI                           | LCP, TBT, CLS and the category scores gated on the 24 routes the Lighthouse config lists (performance ≥95 desktop / ≥90 mobile, accessibility and SEO = 100, best practices ≥95); INP checked in the browser tests |
| Stryker                                 | Weekly mutation testing; a canary run in CI proves the runner still kills mutants                                                                         |
| pnpm 10+ / Node 22.22.2+                | Strict dependency resolution, content-addressed store                                                                                                     |

---

## Quickstart

```bash
git clone git@github.com:erikunha/portfolio.git
cd portfolio
pnpm install
cp .env.example .env.local   # fill in API keys
pnpm dev                      # http://localhost:3000
pnpm test                     # unit tests (vitest)
pnpm test:e2e                 # Playwright E2E + a11y
pnpm build                    # production build
pnpm check                    # Biome lint + format check
pnpm typecheck                # TypeScript strict check
pnpm ci:local                 # the verify chain CI runs first
```

| Command                                                      | Purpose                                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `pnpm validate-content`                                      | Zod validation of every `content/*.ts` module                                             |
| `pnpm bundle-check` / `pnpm route-js-check`                  | Global client-chunk sum / per-route first-load JS gate (both need a build)                |
| `pnpm lhci` / `pnpm lhci:mobile`                             | Lighthouse CI against a running production server (desktop / mobile)                      |
| `pnpm gates:runtime [--skip-build]`                          | Build, start a server, advisory Lighthouse, blocking axe and Chromium e2e                 |
| `pnpm ask:eval`                                              | `/api/ask` correctness, jailbreak and cost eval; writes `ask-eval-result.json`            |
| `pnpm eval:agents`                                           | Prompt-regression eval of the rules in `AGENTS.md`; non-blocking in CI                    |
| `pnpm test:mutation`                                         | Stryker mutation run (weekly in CI)                                                       |
| `pnpm generate:og` / `pnpm generate:icons`                   | Regenerate `public/og.png` / the favicon and app icons                                    |
| `pnpm changelog:sync`                                        | Regenerate the design-system changelog page from `(design-system)`-scoped commits         |

Static content renders without environment variables. Without service credentials, `/api/ask` rejects budget reservation, `/api/contact` cannot save messages, and `/api/lighthouse` returns unavailable scores with `no-store`. See `.env.example` for the full variable list.

---

## Testing the links feed

For deterministic `/links` feed data, set
`E2E_LINKS_FEED_FIXTURE=tests/e2e/fixtures/links-feed.json` during both
`pnpm build` and `pnpm start`. CI uses this fixture for the latest video and
five history rows, including cache revalidation. The fixture includes shard-host
thumbnails for the latest video and history. The loader applies the same URL
normalizer as the live RSS parser before returning the fixture. Thumbnails still
pass through the real Next.js image optimizer and require access to `i.ytimg.com`.
The fixture is returned as written, without the Shorts filter. The fixture flag is ignored on Vercel deployments. Without it, the server loads
the live YouTube feed.

## Reference docs

| Doc                                    | What it covers                                                          |
| -------------------------------------- | ----------------------------------------------------------------------- |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System design, component deep-dives, trade-offs, what to revisit        |
| [`STANDARDS.md`](./STANDARDS.md)       | Engineering bar, 12 domain chapters, each with an enforcement mechanism |
| [`DECISIONS.md`](./DECISIONS.md)       | Running ADR log, why decisions were made and how to reverse them        |
| [`AGENTS.md`](./AGENTS.md)             | Instructions for coding agents working in this repository (`CLAUDE.md` imports it) |
| [`REVIEW.md`](./REVIEW.md)             | What a review reports and what it skips                                 |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Branch names, commit format and the pull request flow                   |
| [`SECURITY.md`](./SECURITY.md)         | Reporting a vulnerability                                               |
| [`docs/`](./docs/README.md)            | Engineering knowledge base (rendering, components, API, workflows) and the `handbook/` |

---

## License

Source code: MIT. Content (copy, CV data, opinions, biographical material): all rights reserved. Forking to learn from the architecture is welcome; replacing my name with yours is not.
