---
name: seo-discovery
description: Keep the discovery surfaces of this site consistent when metadata, routes, identity copy or metrics change. Use when editing the sitemap, robots.txt, llms.txt, /api/erik.json, root metadata or the Open Graph image, when adding or renaming a route, or when the Lighthouse SEO score drops below 100. Do not use for keyword research or content strategy.
---

# Discovery surfaces

This site is a hiring artifact. Recruiters, search engines and AI agents find it through a fixed set
of surfaces. A change to identity, routes or metrics must leave all of them consistent.

## Surfaces

| Surface           | File                                       | Notes                                                                               |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| Sitemap           | `app/sitemap.ts`                           | Home, the `/pt` twins, `/cv`, `/summary`, `/links` and `/links/en` with pt-BR and en-US alternates, plus the design-system routes (English only, from `DS_ROUTES`) |
| Robots            | `public/robots.txt`                        | Allows crawlers, including the AI agents it names                                   |
| LLM index         | `public/llms.txt`                          | Plain-text profile for AI agents; update it with any identity or metric change      |
| Structured profile | `app/api/erik.json/route.ts`              | JSON profile for parsers; cached 24 hours at the edge                               |
| Agent manifest    | `public/.well-known/agent.json`            | Capability manifest for agents: endpoints, profiles and the `/api/mcp` server       |
| JSON-LD           | `content/seo.ts` (`personSchema`)          | Person structured data rendered by the root layout                                  |
| Metadata and OG   | `components/RootShell.tsx`, `app/_lib/locale-metadata.ts`, `app/(en)/design-system/_lib/page-metadata.ts`, `public/og.png` | Root metadata, canonical URLs, the static Open Graph image (`pnpm generate:og` rebuilds it) |

The English home page is the canonical `/`; its pt-BR twin is `/pt`.

## When you change something

1. A new or renamed route: add it to `app/sitemap.ts` with both language alternates, and keep
   `__tests__/sitemap.test.ts` passing.
2. Identity or metric copy: the same fact must hold in the home page, the CV, `public/llms.txt`,
   the profile served at `/api/erik.json` (`lib/hiring-profile.ts`), `public/.well-known/agent.json` and the ask system prompt.
   `__tests__/identity-consistency.test.ts` and `__tests__/metric-consistency.test.ts` hold the
   shared claims; extend them rather than editing one surface by hand.

## Gates

Lighthouse SEO must stay at 100 on desktop and mobile (`lighthouserc.json`,
`lighthouserc.mobile.json`). When it drops, read the failing audit, fix that property, and re-run
`pnpm lhci`. No other analytics script is added.
