# Architecture Overview

> High-level architecture, repository structure, layers, and dependency graph. Read root `ARCHITECTURE.md` for the system design and trade-offs.

## Request model

A request hits Vercel's edge, passes through `proxy.ts` (which stamps CSP + reporting headers), and is served by Next.js. The page `/` is **partially prerendered**: a static shell (the chrome + above-the-fold Hero) is prerendered, while independent ASK and PSI data reads stream behind `<Suspense>`. Client islands hydrate for chrome, animation and interaction. Section content comes from **typed, build-validated `content/*.ts` modules**. A few `/api/*` handlers form a thin **BFF** over Upstash Redis, Resend, the Vercel AI Gateway, and Google PageSpeed Insights. Rate limiting and dedup fail open; the `/api/ask` budget reservation fails closed with 503; contact storage fails closed. Stored messages remain queued when delivery fails.

## System purpose

The site presents a professional profile through the terminal home page, printable `/summary` and `/cv` views, and Portuguese and English link pages. The API supplies contact delivery, grounded answers, machine-readable hiring data and operational probes.

## Architectural layers

```mermaid
flowchart TB
    subgraph edge["Edge / Platform"]
        proxy["proxy.ts<br/>per-request CSP + Reporting-Endpoints"]
        cfg["next.config.ts<br/>static security headers, PPR, MDX"]
    end
    subgraph present["Presentation (RSC-first)"]
        page["app/page.tsx<br/>composition root"]
        sections["components/sections/**<br/>RSC sections and nested groups"]
        islands["client islands<br/>/client/ directories and *.client.*"]
        ds["design-system/**<br/>reusable primitives"]
    end
    subgraph content["Content / Domain"]
        cmods["content/*.ts<br/>typed modules"]
        schemas["content/schemas.ts<br/>central Zod registry"]
    end
    subgraph bff["BFF / Server (lib + app/api)"]
        api["app/api/**<br/>route handlers"]
        handler["lib/server/route.ts<br/>defineHandler envelope"]
        libcore["lib/rate-limit · lib/env · lib/ask/** · lib/ask-log · lib/lighthouse-scores · lib/contact-delivery · lib/contact-outbox"]
    end
    subgraph ext["External services"]
        redis[("Upstash Redis")]
        gw["Vercel AI Gateway<br/>(anthropic/claude-haiku-4-5)"]
        resend["Resend"]
        psi["Google PSI"]
        lf["Langfuse (flag-gated)"]
    end

    proxy --> page
    cfg --> page
    page --> sections --> ds
    page --> islands
    sections --> cmods --> schemas
    islands -->|fetch /api/ask, /api/contact| api
    api --> handler --> libcore
    api -->|bespoke handlers| libcore
    sections -->|Measured reads| libcore
    links["/links · /links/en"] --> feed["lib/links/feed.ts: use cache"]
    feed --> yt["YouTube RSS + optional Data API"]
    libcore --> redis
    libcore --> gw
    libcore --> resend
    libcore --> psi
    libcore -.-> lf
```

**Layer ownership boundaries (who may import whom):**
- `content/*` holds typed data, schemas and shared presentation metadata. Server sections and client islands import different modules to control browser dependencies.
- `design-system/*` primitives use React and shared class utilities. Components import them through the public barrel or an internal module such as `Field`.
- `lib/*` is the server/BFF core. `lib/*.client.tsx` and a few browser utilities are the exception (client-side), clearly suffixed.
- `app/api/*` handlers depend on `lib`. The MCP adapter in `lib/agent/mcp-tools.ts` also imports the ask route for an in-process invocation.

## Repository structure (annotated)

```mermaid
flowchart LR
    root["portfolio/"]
    root --> app["app/"]
    root --> comp["components/"]
    root --> dsx["design-system/"]
    root --> cont["content/"]
    root --> lib["lib/"]
    root --> scr["scripts/ (gates and tools)"]
    root --> tst["tests/ (e2e · a11y · visual)"]
    root --> cl[".claude/ (AI platform)"]
    root --> gh[".github/workflows/"]
    root --> docs["root docs: ARCHITECTURE · STANDARDS · DECISIONS · CLAUDE"]

    app --> a1["page.tsx · layout.tsx · summary/ · cv/ · links/ · sitemap.ts"]
    app --> a2["api/** route handlers"]
    app --> a3["css/** (theme · base · crt · animations · components)"]
    app --> a4["design-system/** MDX docs"]
    comp --> c1["sections/** RSC"]
    comp --> c2["client/** islands"]
    comp --> c3["responsive/** chrome"]
    comp --> c4["AppShell · ErrorBoundary"]
```

## Dependency graph (module-level)

```mermaid
flowchart TD
    page["app/page.tsx (RSC)"] --> bp["BreakpointProvider: initialIsMobile=false"]
    bp --> shell["AppShell.client"]
    shell --> main["PageMain (RSC)"]
    main --> sectionN["sections/* (RSC)"]
    shell --> footer["Footer (RSC), after PageMain"]
    sectionN -. most wrap .-> module["responsive/Module (RSC wrapper)"]
    sectionN --> content["content/* (typed data)"]
    sectionN --> dsprim["design-system/* primitives"]
    sectionN -. hosts .-> island["client islands<br/>InteractiveShell · ContactForm · DawMixer*"]
    content --> schemas["Zod schemas: content/schemas.ts + contact.ts"]
    island -->|HTTP| apiask["app/api/ask"]
    island -->|HTTP| apicontact["app/api/contact"]
    apicontact --> defh["lib/server/route.ts defineHandler"]
    apicontact --> delivery["lib/contact-delivery"]
    apicontact --> outbox["lib/contact-outbox"]
    retry["app/api/contact-retry (daily cron)"] --> delivery
    retry --> outbox
    outbox --> redis
    delivery --> resend["Resend"]
    apiask --> rl["lib/rate-limit"]
    apiask --> askmod["lib/ask/{model,system-prompt,injection,output-guard}"]
    defh --> rl
    rl --> redis[("Upstash")]
    askmod --> gw["AI Gateway"]
    shell --> media["useBreakpoint: matchMedia subscription"]
    shell --> motion["lib/motion.ts (DOM state)"]
```

The main dependency direction is `app → components → {content, design-system}` and `app/api → lib`. Shared utilities and the MCP tool adapter also cross these groups; `lib/agent/mcp-tools.ts` imports the ask route for in-process calls.

Contact submission persists a 90-day KV audit record before calling the shared delivery function. Only Resend acceptance returns 200. Provider failure or timeout returns `202 queued` after adding the id and retry counter to Redis. `ContactForm` distinguishes queued from delivered and reads structured error messages. A `CRON_SECRET` bearer protects the daily 04:00 UTC retry, limited to 3 retries within 7 days. Removing an outbox entry leaves the audit record intact; contact logs contain only request and message ids.

## Build system

- **Bundler:** Turbopack (Next 16). MDX compiled via `@next/mdx`, with local remark wrapper paths and the `rehype-pretty-code` package configured as string-tuples.
- **Rendering:** `cacheComponents: true` enables PPR / dynamicIO. `typedRoutes: true` gives compile-time route safety. `trailingSlash: false` is explicit.
- **Scripts (`tsx`-run):** content validation, static gates, PR checks, the AI eval harness, and the design-system changelog generator. See doc 07.
- **CSS:** Tailwind v4 via the single `@tailwindcss/postcss` plugin; no Style Dictionary, no CSS modules. Tokens are `@theme` custom properties (doc 04).

## Key load-bearing files (read these first)

| File                                      | Why it matters                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `app/page.tsx`                            | The composition root; shows the RSC/PPR posture for the whole site                 |
| `app/layout.tsx`                          | Fonts, JSON-LD, the pre-paint motion bootstrap, Vercel RUM gating                  |
| `next.config.ts` + `proxy.ts`             | The two-place header split (static vs per-request CSP), PPR, MDX                   |
| `lib/server/route.ts`                     | The `defineHandler` envelope - the API contract                                    |
| `lib/rate-limit.ts`                       | Redis access, the sliding-window + token-budget + dedup primitives                 |
| `lib/ask/system-prompt.ts`                | How the AI persona imports shared content                                          |
| `content/schemas.ts`                      | The domain schema registry                                                         |
| `components/responsive/Module/Module.tsx` | RSC wrapper for terminal modules; Hero, About, Career and Footer render separately |
