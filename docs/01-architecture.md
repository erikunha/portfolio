# Architecture Overview

> High-level architecture, repository structure, layers, and dependency graph. For the original design narrative and trade-off reasoning, read root `ARCHITECTURE.md`; this doc is the reverse-engineered structural map.

## The one-paragraph mental model

A request hits Vercel's edge, passes through `proxy.ts` (which stamps CSP + reporting headers), and is served by Next.js. The page `/` is **partially prerendered**: a static shell (the chrome + above-the-fold Hero) is delivered instantly, while a handful of sections that branch on viewport stream in per-request behind `<Suspense>`. Almost no application JavaScript ships - only a small set of **client islands** hydrate. All visible copy comes from **typed, build-validated `content/*.ts` modules**. A few `/api/*` handlers form a thin **BFF** over Upstash Redis, Resend, the Vercel AI Gateway, and Google PageSpeed Insights, with a uniform fail-open posture.

## Why this architecture exists

The product's thesis (root `CLAUDE.md`, `DECISIONS.md` 2026-05-23) is that **architecture is the artifact**: this is a hiring/reference system, so every layer is built to demonstrate a defensible engineering bar. That explains choices that would be over-engineering for a "normal" portfolio: a content-validation gate, a design-system with CI-enforced token boundaries, an AI endpoint held to a production eval bar, and a mechanical development platform. The guiding rules (root `CLAUDE.md`): cross-cutting concerns over local optimization; mechanism over outcome; perf/a11y/security are implicit on every change, not separate phases.

## Architectural layers

```mermaid
flowchart TB
    subgraph edge["Edge / Platform"]
        proxy["proxy.ts<br/>per-request CSP + Reporting-Endpoints"]
        cfg["next.config.ts<br/>static security headers, PPR, MDX"]
    end
    subgraph present["Presentation (RSC-first)"]
        page["app/page.tsx<br/>composition root"]
        sections["components/sections/**<br/>~20 RSC sections"]
        islands["components/client/** + responsive/**<br/>client islands (*.client.tsx)"]
        ds["design-system/**<br/>8 reusable primitives"]
    end
    subgraph content["Content / Domain"]
        cmods["content/*.ts<br/>typed modules"]
        schemas["content/schemas.ts<br/>central Zod registry"]
    end
    subgraph bff["BFF / Server (lib + app/api)"]
        api["app/api/**<br/>route handlers"]
        handler["lib/server/route.ts<br/>defineHandler envelope"]
        libcore["lib/rate-limit · lib/env · lib/ask/** · lib/ask-log · lib/lighthouse-scores"]
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
    libcore --> redis
    libcore --> gw
    libcore --> resend
    libcore --> psi
    libcore -.-> lf
```

**Layer ownership boundaries (who may import whom):**

- `content/*` is a **leaf**: pure data + Zod, imported by sections (RSC) and, for the three client-safe modules, by islands. It never imports `lib` or `components`.
- `design-system/*` primitives are **leaves**: no app imports, only React + `cx`. The app depends on the design system, never the reverse.
- `lib/*` is the server/BFF core. `lib/*.client.tsx` and a few browser utilities are the exception (client-side), clearly suffixed.
- `app/api/*` handlers depend on `lib`; `lib` never depends on `app`.

## Repository structure (annotated)

```mermaid
flowchart LR
    root["portfolio/"]
    root --> app["app/"]
    root --> comp["components/"]
    root --> dsx["design-system/"]
    root --> cont["content/"]
    root --> lib["lib/"]
    root --> scr["scripts/ (~40 gates/tools)"]
    root --> tst["tests/ (e2e · a11y · visual)"]
    root --> cl[".claude/ (AI platform)"]
    root --> gh[".github/workflows/"]
    root --> docs["root docs: ARCHITECTURE · STANDARDS · DECISIONS · CLAUDE"]

    app --> a1["page.tsx · layout.tsx · not-found.tsx · sitemap.ts"]
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
    page["app/page.tsx (RSC)"] --> shell["AppShell.client"]
    page --> sectionN["sections/* (RSC)"]
    sectionN --> module["responsive/Module (RSC wrapper)"]
    sectionN --> content["content/* (typed data)"]
    sectionN --> dsprim["design-system/* primitives"]
    sectionN -. hosts .-> island["client islands<br/>InteractiveShell · ContactForm · DawMixer*"]
    content --> schemas["content/schemas.ts (Zod)"]
    island -->|HTTP| apiask["app/api/ask"]
    island -->|HTTP| apicontact["app/api/contact"]
    apicontact --> defh["lib/server/route.ts defineHandler"]
    apiask --> rl["lib/rate-limit"]
    apiask --> askmod["lib/ask/{model,system-prompt,injection,output-guard}"]
    defh --> rl
    rl --> redis[("Upstash")]
    askmod --> gw["AI Gateway"]
    shell --> bp["lib/use-breakpoint.client"]
    shell --> motion["lib/motion.ts (DOM state)"]
```

**No circular dependencies exist** in the application graph (the `fallow-audit` skill exists specifically to detect them). The clean direction is: `app → components → {content, design-system}` and `app/api → lib`, with `content` and `design-system` as terminal leaves.

## Build system

- **Bundler:** Turbopack (Next 16). MDX compiled via `@next/mdx` with `.mjs` remark/recma plugins (`remark-gfm-wrapper`, `remark-preview-source`, `rehype-pretty-code`) referenced by absolute path string-tuples (a Turbopack requirement).
- **Rendering:** `cacheComponents: true` enables PPR / dynamicIO. `typedRoutes: true` gives compile-time route safety. `trailingSlash: false` is explicit (it fixed a Vercel-layer 308 on `/api/healthz`).
- **Scripts (`tsx`-run):** content validation, ~15 `check-*` gate scripts, the review/verification/learning toolchain (doc 06), the AI eval harness, and the design-system changelog generator. See doc 07.
- **CSS:** Tailwind v4 via the single `@tailwindcss/postcss` plugin; no Style Dictionary, no CSS modules. Tokens are `@theme` custom properties (doc 04).

## Key load-bearing files (read these first)

| File | Why it matters |
|---|---|
| `app/page.tsx` | The composition root; shows the RSC/PPR posture for the whole site |
| `app/layout.tsx` | Fonts, JSON-LD, the pre-paint motion bootstrap, Vercel RUM gating |
| `next.config.ts` + `proxy.ts` | The two-place header split (static vs per-request CSP), PPR, MDX |
| `lib/server/route.ts` | The `defineHandler` envelope - the API contract |
| `lib/rate-limit.ts` | Redis access, the sliding-window + token-budget + dedup primitives |
| `lib/ask/system-prompt.ts` | How the AI persona is composed from live content (drift-proof) |
| `content/schemas.ts` | The domain schema registry |
| `components/responsive/Module/Module.tsx` | The RSC section wrapper every section uses |
