# Architecture Overview

> High-level architecture, repository structure, layers, and dependency graph. Read root `ARCHITECTURE.md` for the system design and trade-offs.

## Request model

A request hits Vercel's edge, passes through `proxy.ts` (which stamps CSP + reporting headers), and is served by Next.js, which renders React Server Components (RSC, components that run only on the server). The page `/` is **partially prerendered** (PPR): a static shell (the chrome + above-the-fold Hero) is prerendered, while independent ASK and PSI data reads stream behind `<Suspense>`. Client islands hydrate for chrome, animation and interaction. Section content comes from **typed, build-validated `content/*.ts` modules**. A few `/api/*` handlers form a thin **BFF** (backend for frontend: one server layer that shapes calls to outside services for this site) over Upstash Redis, Resend, the Vercel AI Gateway, and Google PageSpeed Insights (PSI). Rate limiting and dedup fail open; the `/api/ask` budget reservation fails closed with 503; contact storage fails closed. Stored messages remain queued when delivery fails.

## System purpose

The site presents a professional profile through the terminal home page, printable `/summary` and `/cv` views, and Portuguese and English link pages. The whole site is bilingual pt-BR/EN: the bare address serves English and `/pt` serves pt-BR, the address alone determines the language (no framework, negotiation or middleware), and each language names itself canonical with `alternates.languages` plus `x-default`. `/links` is the exception: it is the pt-BR page and `/links/en` the English one. The API supplies contact delivery, grounded answers, machine-readable hiring data and operational probes.

## Architectural layers

The layering reads in three steps: the edge and the presentation root, the content and BFF layers the presentation calls into, and the external services those layers reach.

```mermaid
flowchart TB
    subgraph edge["Edge / Platform"]
        proxy["proxy.ts<br/>per-request CSP + Reporting-Endpoints"]
        cfg["next.config.ts<br/>static security headers, PPR, MDX"]
    end
    subgraph present["Presentation (RSC-first)"]
        page["components/SiteHome.tsx<br/>composition root"]
        sections["components/sections/**<br/>RSC sections and nested groups"]
        islands["client islands<br/>/client/ directories and *.client.*"]
        ds["design-system/**<br/>reusable primitives"]
    end
    proxy --> page
    cfg --> page
    page --> sections --> ds
    page --> islands
```

The content layer feeds the sections, and every route handler goes through the shared BFF envelope:

```mermaid
flowchart TB
    subgraph content["Content / Domain"]
        cmods["content/*.ts<br/>typed modules"]
        schemas["content/schemas.ts<br/>central Zod registry"]
        gate["content/_validate-client-content.ts<br/>build-time parse site"]
    end
    subgraph bff["BFF / Server (lib + app/api)"]
        api["app/api/**<br/>route handlers"]
        handler["lib/server/route.ts<br/>defineHandler envelope"]
        libcore["lib/rate-limit · lib/env · lib/ask/** · lib/ask-log · lib/lighthouse-scores · lib/contact-delivery · lib/contact-outbox"]
    end
    sections["components/sections/**<br/>RSC sections and nested groups"] --> cmods
    cmods --> schemas
    gate -->|imports + parses| cmods
    gate --> schemas
    api --> handler --> libcore
    api -->|bespoke handlers| libcore
```

The BFF core talks to the external services, the islands fetch through the route handlers, the sections read measured data, and the links pages read their own cached feed:

```mermaid
flowchart TB
    libcore["lib/rate-limit · lib/env · lib/ask/** · lib/ask-log · lib/lighthouse-scores · lib/contact-delivery · lib/contact-outbox"]
    subgraph ext["External services"]
        redis[("Upstash Redis")]
        gw["Vercel AI Gateway<br/>(anthropic/claude-haiku-5.5)"]
        resend["Resend"]
        psi["Google PSI"]
        lf["Langfuse (flag-gated)"]
    end
    links["/links · /links/en"] --> feed["lib/links/feed.ts: use cache"]
    feed --> yt["YouTube Data API uploads paging, RSS fallback"]
    libcore --> redis
    libcore --> gw
    libcore --> resend
    libcore --> psi
    libcore -.-> lf
    islands["client islands<br/>/client/ directories and *.client.*"] -->|fetch /api/ask, /api/contact| api["app/api/**<br/>route handlers"]
    sections["components/sections/**<br/>RSC sections and nested groups"] -->|Measured reads| libcore
```

**Layer ownership boundaries (who may import whom):**
- `content/*` holds typed data, schemas and shared presentation metadata. Server sections and client islands import different modules to control browser dependencies.
- `design-system/*` primitives use React and shared class utilities. Components import them through the public barrel or an internal module such as `Field`.
- `lib/*` is the server/BFF core. `lib/*.client.tsx` and a few browser utilities are the exception (client-side), clearly suffixed.
- `app/api/*` handlers depend on `lib`. The MCP adapter in `lib/agent/mcp-tools.ts` also imports the ask route for an in-process invocation.

## Repository structure (annotated)

The repository root, with `app/` and its two route groups expanded:

```mermaid
flowchart LR
    root["portfolio/"]
    root --> app["app/"]
    app --> a1["(en)/ and (pt)/ route groups, each with its root layout · sitemap.ts · global-error.tsx · _lib/"]
    app --> a2["api/** route handlers"]
    app --> a3["css/** (theme · base · crt · animations · print · forced-colors · components-*)"]
    app --> a4["(en)/design-system/** MDX docs"]
```

The other top-level directories, with `components/` expanded:

```mermaid
flowchart LR
    root["portfolio/"]
    root --> comp["components/"]
    root --> dsx["design-system/"]
    root --> cont["content/"]
    root --> lib["lib/"]
    root --> scr["scripts/ (gates and tools)"]
    root --> tst["tests/ (e2e · a11y · visual)"]
    root --> cl[".agents/ · .claude/ · .codex/ (AI platform)"]
    root --> gh[".github/workflows/"]
    root --> docs["root docs: ARCHITECTURE · STANDARDS · DECISIONS · AGENTS · REVIEW"]
    root --> kb["docs/ knowledge base · evals/ · metrics/ · __tests__/"]
    comp --> c1["sections/** RSC"]
    comp --> c2["client/** islands"]
    comp --> c3["responsive/** chrome"]
    comp --> c4["SiteShell · AppShell · ErrorBoundary · RootShell"]
    comp --> c5["links/** · reading/** · ErrorPages/**"]
```

## Dependency graph (module-level)

The rendering chain and the section modules:

```mermaid
flowchart TD
    page["components/SiteHome.tsx (RSC)"] --> siteshell["SiteShell (RSC)"]
    siteshell --> shell["AppShell.client"]
    shell --> main["PageMain (RSC)"]
    main --> sectionN["sections/* (RSC)"]
    shell --> footer["Footer (RSC), after PageMain"]
    sectionN -. most wrap .-> module["responsive/Module (RSC wrapper)"]
    sectionN --> content["content/* (typed data)"]
    sectionN --> dsprim["design-system/* primitives"]
    sectionN -. hosts .-> island["client islands<br/>InteractiveShell · ContactForm · DawMixer*"]
    content --> schemas["Zod schemas: content/schemas.ts + contact.ts"]
    gate["build-time parse site: content/_validate-client-content.ts"] -->|imports + parses| content
    gate --> schemas
    shellisland["InteractiveShell island"] --> media["useBreakpoint: matchMedia subscription, no context"]
    shell --> motion["lib/motion.ts (DOM state)"]
```

The API paths the islands call, and the services behind them:

```mermaid
flowchart TD
    island["client islands<br/>InteractiveShell · ContactForm · DawMixer*"] -->|HTTP| apiask["app/api/ask"]
    island -->|HTTP| apicontact["app/api/contact"]
    apicontact --> defh["lib/server/route.ts defineHandler"]
    apicontact --> delivery["lib/contact-delivery"]
    apicontact --> outbox["lib/contact-outbox"]
    retry["app/api/contact-retry (daily cron)"] --> delivery
    retry --> outbox
    outbox --> redis
    delivery --> resend["Resend"]
    apiask --> rl["lib/rate-limit"]
    apiask --> askmod["lib/ask/{model,system-prompt,injection,output-guard,preflight,stream}"]
    defh --> rl
    rl --> redis[("Upstash")]
    askmod --> gw["AI Gateway"]
```

The main dependency direction is `app → components → {content, design-system}` and `app/api → lib`. Shared utilities and the MCP tool adapter also cross these groups; `lib/agent/mcp-tools.ts` imports the ask route for in-process calls.

Contact submission persists a 90-day KV audit record before calling the shared delivery function. Only Resend acceptance returns 200. Provider failure or timeout returns `202 queued` after adding the id and retry counter to Redis. `ContactForm` distinguishes queued from delivered and reads structured error messages. A `CRON_SECRET` bearer protects the daily 04:00 UTC retry, limited to 3 retries within 7 days. Removing an outbox entry leaves the audit record intact; a delivery failure that cannot be queued (full or failing outbox) deletes the record, since nothing will retry it; contact logs contain only request and message ids.

## Build system

- **Bundler:** Turbopack (Next 16). MDX compiled via `@next/mdx`, with local remark wrapper paths and the `rehype-pretty-code` package configured as string-tuples.
- **Type check:** `pnpm typecheck` runs `tsgo` (the native TypeScript compiler preview); `typescript` itself stays on 6.x for the mutation runner.
- **Install-time scripts:** `postinstall` runs `scripts/strip-next-polyfills.mjs`, which replaces Next's legacy polyfill bundles in `node_modules` with a one-line comment. The `browserslist` floor (Chrome 93, Safari 15.4) never needs them, and left in place they count against the client-chunk gate and Lighthouse Best Practices. The script exits non-zero when Next moves those files. `prepare` installs the Husky hooks and skips CI and Vercel.
- **Rendering:** `cacheComponents: true` enables PPR / dynamicIO. `typedRoutes: true` gives compile-time route safety. `trailingSlash: false` is explicit.
- **Scripts (`tsx`-run):** content validation, static gates, PR checks, the AI eval harness, and the design-system changelog generator. See doc 07.
- **CSS:** Tailwind v4 via the single `@tailwindcss/postcss` plugin; no Style Dictionary, no CSS modules. Tokens are `@theme` custom properties (doc 04).

## Key load-bearing files (read these first)

| File                                      | Why it matters                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `components/SiteHome.tsx`                 | The composition root; shows the RSC/PPR posture for the whole site                                                           |
| `components/RootShell.tsx`                | Fonts, JSON-LD, the pre-paint motion bootstrap, Vercel RUM gating, shared by `app/(en)/layout.tsx` and `app/(pt)/layout.tsx` |
| `next.config.ts` + `proxy.ts`             | The two-place header split (static vs per-request CSP), PPR, MDX                                                             |
| `lib/server/route.ts`                     | The `defineHandler` envelope - the API contract                                                                              |
| `lib/rate-limit.ts`                       | Redis access, the sliding-window + token-budget + dedup primitives                                                           |
| `lib/ask/system-prompt.ts`                | How the AI persona imports shared content                                                                                    |
| `content/schemas.ts`                      | The domain schema registry                                                                                                   |
| `content/site-locale.ts`                  | Locale codes, `<html lang>` values, localized paths and the hreflang alternates every page and the sitemap derive from       |
| `content/section-registry.ts`             | The nine home navigation destinations: ids, labels, icons and order                                                          |
| `components/responsive/Module/Module.tsx` | RSC wrapper for terminal modules; Hero, About, Career and Footer render separately                                           |
