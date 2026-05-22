# erikunha.dev

Single-page Next.js 16 portfolio deployed to Vercel Edge. RSC-first composition of ~18 sections with four client islands, a streaming LLM endpoint, a durable contact form, and a CI pipeline that enforces performance, accessibility, and bundle size as hard contracts.

**Live:** [erikunha.dev](https://erikunha.dev)

<p>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs&logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" />
  <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-Edge-000?logo=vercel&logoColor=white" />
  <img alt="pnpm 10" src="https://img.shields.io/badge/pnpm-10+-F69220?logo=pnpm&logoColor=white" />
  <img alt="Node 22" src="https://img.shields.io/badge/Node-22+-417E38?logo=nodedotjs&logoColor=white" />
  <img alt="Biome" src="https://img.shields.io/badge/Biome-lint%20%2B%20format-60A5FA?logo=biome&logoColor=white" />
  <img alt="Vitest" src="https://img.shields.io/badge/Vitest-unit-6E9F18?logo=vitest&logoColor=white" />
  <img alt="Playwright" src="https://img.shields.io/badge/Playwright-E2E%20%2B%20a11y-2EAD33?logo=playwright&logoColor=white" />
  <img alt="Lighthouse CI" src="https://img.shields.io/badge/Lighthouse-CI%20gates-F44B21?logo=lighthouse&logoColor=white" />
  <img alt="Anthropic" src="https://img.shields.io/badge/Anthropic-Haiku%204.5-D97757?logo=anthropic&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/code-MIT-blue" />
</p>

---

This is Erik Cunha's hiring artifact for Staff/Principal frontend and applied-AI roles. The codebase demonstrates the engineering it claims — a site that says "performance-first" but ships a 400 KB JS bundle is self-disqualifying. Every architectural decision is documented in `ARCHITECTURE.md` with trade-offs and reversibility notes.

The AI centerpiece is a streaming `ask` endpoint (Vercel AI Gateway + Anthropic Haiku 4.5, prompt-cached, rate-limited, budget-capped) with a correctness eval suite and a visible metrics panel — making AI quality observable to hiring reviewers. Agent-readiness surfaces include `/.well-known/agent.json` and a minimal MCP server.

---

## Stack

| Technology | Purpose |
|---|---|
| Next.js 16 (App Router) | RSC-first static generation with selective client islands |
| React 19 | Server components + streaming hydration |
| TypeScript strict | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Vercel AI Gateway + Anthropic Haiku 4.5 | Streaming `/api/ask` with prompt caching and cost tracking |
| Upstash Redis | Rate limiting, budget cap, KV interaction log |
| Hand-written CSS (10 files) | No framework; BEM-ish naming, tokens in `_tokens.css` |
| Biome | Lint + format in a single Rust binary |
| Vitest + Playwright | Unit + E2E + axe-core a11y CI suite |
| Lighthouse CI | LCP, INP, CLS gated per PR |
| pnpm 10+ / Node 22+ | Strict dependency resolution, content-addressed store |

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
```

The static page renders without environment variables. Runtime endpoints (`/api/ask`, `/api/contact`, `/api/lighthouse`) error until keys are set. See `.env.example` for the full variable list.

---

## Reference docs

| Doc | What it covers |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System design, component deep-dives, trade-offs, what to revisit |
| [`STANDARDS.md`](./STANDARDS.md) | Engineering bar — 11 domain chapters, each with an enforcement mechanism |
| [`DECISIONS.md`](./DECISIONS.md) | Running ADR log — why decisions were made and how to reverse them |
| [`CLAUDE.md`](./CLAUDE.md) | AI assistant instructions (auto-loaded by Claude Code each session) |

---

## License

Source code: MIT. Content (copy, CV data, opinions, biographical material): all rights reserved. Forking to learn from the architecture is welcome; replacing my name with yours is not.
