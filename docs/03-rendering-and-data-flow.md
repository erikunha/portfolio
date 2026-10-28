# Rendering & Data Flow

> Routing tree, the RSC/PPR rendering pipeline, and end-to-end data flows with sequence diagrams. This is the doc that explains _how a request becomes pixels_ and _how a user action becomes a persisted effect_.

## Routing tree

```mermaid
flowchart TD
    layout["app/layout.tsx (RootLayout, RSC)<br/>fonts · JSON-LD · motion bootstrap · Vercel RUM"]
    layout --> home["/ -> app/page.tsx (RSC, SSG+PPR)"]
    layout --> ds["/design-system -> design-system/layout.tsx"]
    layout --> nf["/* (404) -> app/not-found.tsx"]
    layout --> sm["/sitemap.xml -> app/sitemap.ts"]
    ds --> ds1["/design-system (page.mdx)"]
    ds --> ds2["/design-system/tokens"]
    ds --> ds3["/design-system/components"]
    ds --> ds4["/design-system/enforcement"]
    ds --> ds5["/design-system/changelog (git-generated)"]
    subgraph api["API cluster (app/api/**)"]
      api1["POST /api/ask (streaming)"]
      api2["POST /api/contact (defineHandler)"]
      api3["GET /api/healthz"]
      api4["GET /api/psi-refresh (cron)"]
      api5["POST /api/csp-report"]
      api6["GET /api/erik.json"]
      api7["GET /api/lighthouse"]
      api8["POST /api/log · POST /api/log/forget"]
      api9["POST /api/mcp (stateless Streamable HTTP; GET returns 405)"]
      api10["GET /api/contact-retry (daily cron)"]
    end
    layout -.serves.-> api
```

There is **one user-facing page** (`/`). Everything else is the design-system docs, metadata routes, and the API cluster. Error UI uses the client `ErrorBoundary` component (not the App Router `error.tsx` convention); there is no `loading.tsx`/`template.tsx`.

## Layout hierarchy (what wraps what)

```mermaid
flowchart TD
    html["html (mono+display font vars)"] --> body["body (suppressHydrationWarning)"]
    body --> boot["inline script: set body[data-motion] BEFORE paint"]
    body --> children["{route children}"]
    body --> rum["Analytics + SpeedInsights (only when VERCEL=1)"]
    children --> bp["BreakpointProvider (client, initialIsMobile from server UA)"]
    bp --> appshell["AppShell (client chrome)"]
    appshell --> chrome["MatrixRain · CRTOverlay (6 layers) · DesktopTopbar · StatusBar+MobileTitleBar · Dock · ToTopButton · skip-link"]
    appshell --> main["main#main-content"]
    main --> secs["19 ErrorBoundary-wrapped sections:<br/>Hero + 18 Modules (RSC)"]
    main --> footer["Footer (RSC)"]
    footer --> footerIslands["FooterLazy: session counters + halt/reboot island"]
```

The motion bootstrap script is load-bearing: it reads `localStorage('erik.motion')` / OS preference and sets `body[data-motion]` **before first paint**, off the hydration path, so CRT effects and the LCP element never flash or wait on JS.

## The rendering pipeline (RSC + PPR)

`cacheComponents: true` turns on Partial Prerendering. The mechanism in this codebase:

```mermaid
flowchart LR
    req["Request"] --> px["proxy.ts: add CSP + Reporting-Endpoints"]
    px --> shell["Static shell prerendered at edge:<br/>AppShell chrome + Hero (outside Suspense) + above-fold sections"]
    shell --> stream["Server streams"]
    stream --> susp["Suspense boundaries resolve per-request"]
    susp --> dyn["UA-selected section variants<br/>and independent ASK / PSI data reads"]
    dyn --> html2["Streamed HTML"]
    html2 --> hydrate["Client hydrates ONLY AppShell chrome + named islands"]
    hydrate --> lazy["next/dynamic + IO-gated islands load on demand"]
```

**Static vs dynamic, concretely:**
- **Static (prerendered):** the whole `AppShell` chrome, `Hero` (outside Suspense so LCP never waits), `Readme`, `Shell`, Projects with its attached receipts, and section fallbacks. Projects uses one RSC tree with CSS controlling the responsive grid.
- **UA-selected variants:** `ManPage`, `GitLog`, `Visa`, `Guitar` and `DawMixer` wrap an async RSC that calls `getIsMobile()` (`lib/ua.ts`, which reads `headers()`). Their fallbacks are prerendered; the selected variants stream per request.
- **Measured data:** `AiMetricsSection` renders the `sec-live-metrics` module. It composes `AiMetricsData` and `LivePerfSection`, with independent Suspense boundaries for ASK, desktop PSI and mobile PSI. Each fallback retains its metric layout and shows a loading state. Receipts remain inside Projects rather than a separate module.
- **The dual-variant pattern** (e.g. `ManPageSection.tsx`):

  ```
  <Module><Suspense fallback={<Desktop/>}><AsyncInner/></Suspense></Module>
  ```

  `AsyncInner` awaits `getIsMobile()` and renders `<ManPageDesktop/>` or `<ManPageMobile/>`. Fallback choice is per-section: the desktop variant for ManPage, GitLog and Visa; `null` for Guitar and DawMixer.
- **`defer` prop:** fourteen below-the-fold sections pass `defer` to `Module`, which applies CSS `content-visibility` to defer render cost.
- **`next/dynamic` lazy JS:** `ContactFormLazy`, `InteractiveShellLazy`, `DawMixerSection`. `Footer` is an RSC: content, cards, sitemap and shutdown log render on the server. `FooterLazy` loads only the session counters and halt/reboot island from `Footer.client`; the netstat card uses the design-system `CopyButton` island. Counters start at mount to include commands before the footer is reached. The halt clock is empty on the server and reads the visitor’s clock after mount.

There is **no `use cache` / `cacheLife` / `cacheTag` / `unstable_cache` / `generateStaticParams`** anywhere - the staticness comes from PPR + the absence of dynamic APIs, not explicit caching.

## End-to-end data flow #1 - page render (read path)

```
build time:  content/*.ts imported -> Zod parse (gate) -> typed data baked into RSC output
eval run:    scripts/ask-eval.ts -> Redis ask:eval:latest
request:     proxy.ts headers -> static shell streamed -> getIsMobile() resolves per request
             -> section variants and independent ASK / PSI reads stream -> client hydrates islands
```

The content layer is build-time: static copy is already in the prerendered output. Measured reads live data through `lib/ask-metrics.ts` and `lib/lighthouse-scores.ts`. PSI uses its Redis cache and may fetch PageSpeed Insights when the cache is missing. Projects does not read the user agent or wait on live data.

## End-to-end data flow #2 - `/api/ask` (the streaming AI feature)

This is the richest flow in the system. Transport is **plain `fetch` reading a raw `ReadableStream` of `text/plain`** - not SSE, and the AI SDK runs server-side only.

```mermaid
sequenceDiagram
    participant U as InteractiveShell (client island)
    participant R as app/api/ask/route.ts
    participant RL as lib/rate-limit
    participant G as lib/ask/output-guard (Layer 1)
    participant AI as Vercel AI Gateway (Haiku)
    participant KV as Upstash Redis

    U->>R: POST /api/ask { question }
    R->>R: ASK_ENABLED kill-switch (503 if off)
    R->>RL: getAskLimit().limit(ip)  (8/h, fail-open)
    R->>R: parse + validate (trim, <=500 chars)
    R->>R: INJECTION_RE reject (400)
    R->>RL: checkIdenticalQuestion (60s dedup, 429)
    R->>RL: reserveBudget(512)  (monthly token cap, 503 if exhausted)
    R->>R: mint 128-bit sentinel, wrap question as data-only
    R->>AI: streamText(model=ASK_MODEL, cacheControl: ephemeral)
    loop each delta (raced vs 15s watchdog)
        AI-->>R: text chunk
        R->>G: Layer-1 egress scan (leak markers / 4000-char runaway)
        alt leak/runaway
            G-->>R: abort -> append STREAM_ERR_SENTINEL
        else clean
            R-->>U: enqueue chunk
        end
    end
    U->>U: parseStreamChunk -> rAF-coalesced setStreamingText (renders THROUGH React)
    R->>KV: finally: settleBudget(refund) + Layer-2 audit + ask-log (fail-quiet)
    U->>U: finalize() -> commit answer (or error line) into history
```

**Client-side rendering nuance (verified in code):** the streamed text lands in an _isolated_ `streamingText` state and is flushed at most once per animation frame (`requestAnimationFrame`), so a per-chunk update re-renders only one `<span>`, never the whole feed. This is the opposite of the Hero boot loop, which mutates `textContent` directly with no React state (see doc 04). Both are deliberate INP guards.

**Server timeouts (defense in depth):** 30s whole-request `AbortSignal`, 15s mid-stream watchdog, 1s usage-resolve. The token budget is held **fail-closed** if usage can't be resolved (so a metering bug can't leak spend), while the rate limiters and dedup are **fail-open**. The one exception is the budget reservation: if Redis fails there, `/api/ask` returns 503 rather than answer without a spend cap.

## End-to-end data flow #3 - `/api/contact` (the write path via `defineHandler`)

```mermaid
sequenceDiagram
    participant F as ContactForm (client)
    participant H as defineHandler (lib/server/route.ts)
    participant KV as Upstash Redis
    participant RS as Resend

    F->>H: POST /api/contact { name, email, message, field_company }
    H->>H: getContactLimit().limit(ip)  (3/10m, BEFORE parse, fail-open)
    H->>H: req.json() (400 invalid_json)
    H->>H: ContactSchema.safeParse (400 validation_failed)
    H->>H: hashIp(ip)  (only after passing the gates)
    H->>H: honeypot field_company? -> jittered fake-200
    H->>KV: write contact:msg:* (durability-first)
    alt KV fails
        H-->>F: 502 storage_unavailable
    else KV ok
        H->>RS: sendContactMessage (10s race)
        alt Resend accepts
            H-->>F: 200 { ok: true, requestId }
        else Resend error, timeout or missing key
            H->>KV: enqueue id by receivedAt, attempts = 0
            alt outbox saved
                H-->>F: 202 { ok: false, requestId, error: { code: queued, message } }
                F->>F: show saved, not delivered yet + LinkedIn link
            else outbox write fails
                H-->>F: 502 storage_unavailable
            end
        end
    end
```

The **ordering is a security property**: rate-limit and validate _before_ the work, hash the IP and touch storage _only_ for requests that pass. Every response carries `X-Request-Id`. See doc 05 for the full `defineHandler` contract and the other routes.

At 04:00 UTC daily (`0 4 * * *`), `/api/contact-retry` checks the `CRON_SECRET` bearer before reading pending ids in received-time order. Messages older than 7 days, or already at 3 retry attempts, leave the outbox. Each eligible message consumes an attempt before calling the same delivery function. Successful sends leave the outbox; failures remain pending. Audit messages retain their 90-day KV TTL. The response counts `sent`, `failed`, `expired` and `exhausted`. Contact logs carry only `requestId` and `msgId`.

## Request lifecycle summary (every request)

```mermaid
flowchart LR
    e["Edge"] --> p["proxy.ts<br/>CSP + Reporting-Endpoints<br/>(skips _next/static, images)"]
    p --> n["next.config.ts static headers<br/>COOP · XFO · HSTS · nosniff"]
    n --> route{route type}
    route -->|page| ppr["PPR: static shell + streamed dynamic sections"]
    route -->|api| handler["defineHandler or bespoke streaming handler"]
    handler --> failopen["rate limits fail open, budget reservation fails closed; X-Request-Id on every response"]
```
