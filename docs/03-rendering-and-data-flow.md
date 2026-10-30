# Rendering & Data Flow

> Routing tree, the RSC/PPR rendering pipeline, and end-to-end data flows with sequence diagrams. This is the doc that explains _how a request becomes pixels_ and _how a user action becomes a persisted effect_.

## Routing tree

```mermaid
flowchart TD
    layout["app/layout.tsx (RootLayout, RSC)<br/>fonts · JSON-LD · motion bootstrap · Vercel RUM"]
    layout --> home["/ -> app/page.tsx (RSC, SSG+PPR)"]
    layout --> cv["/cv -> app/cv/page.tsx"]
    layout --> summary["/summary -> app/summary/page.tsx"]
    layout --> links["/links · /links/en -> localized RSC + cached YouTube feed"]
    layout --> errors["error.tsx -> route error recovery"]
    globalError["global-error.tsx -> replaces RootLayout on root failure"]
    layout --> ds["/design-system -> design-system/layout.tsx"]
    layout --> nf["/* (404) -> app/not-found.tsx"]
    layout --> sm["/sitemap.xml -> app/sitemap.ts"]
    ds --> ds1["/design-system (page.mdx)"]
    ds1 --> toc["OnThisPage: sections and principles links"]
    ds1 --> opinion["DesignSystemOpinion: docs-placement DS take"]
    opinion --> takes["content/hottest-takes.ts"]
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
      api9["POST /api/mcp (stateless handler; POST body limit 4096 bytes)"]
      api10["GET /api/contact-retry (daily cron)"]
    end
    layout -.serves.-> api
```

The user-facing routes are `/`, `/summary`, `/cv`, `/links` and `/links/en`, alongside the design-system docs, metadata routes and API cluster. Home sections use the client `ErrorBoundary` component. App Router failures also have `app/error.tsx` and `app/global-error.tsx`; there is no `loading.tsx`/`template.tsx`.

## Terminal sections and navigation

`content/section-registry.ts` defines nine navigation destinations: Home (`bio`), About, Projects, Career, Interactive shell, Measured, Opinions, Guitar and mixer, and Contact. It supplies aliases, icons, screen-reader labels and navigation order. `content/section-labels.ts` adds labels for supporting modules.

The JSX order in `app/page.tsx` is Hero, About, Shell, Measured, Projects, GitLog, HottestTakes (with Unknowns nested inside), Guitar, DawMixer and Contact (including work authorization). Footer follows `PageMain` as its sibling. CSS mobile ordering is a separate map in `app/css/base.css`.

About contains Whoami, Now, Responsibilities, Stack and retry-code panels. Responsibilities and retry code are named keyboard scroll regions inside About. Projects contains its receipts. Career contains certification, education and community tag groups. Measured contains independent ASK, desktop PSI and mobile PSI reads. These nested groups do not become separate navigation destinations.

## Layout hierarchy (what wraps what)

```mermaid
flowchart TD
    html["html (mono+display font vars)"] --> body["body (suppressHydrationWarning)"]
    body --> boot["inline script: set body[data-motion] BEFORE paint"]
    body --> children["{route children}"]
    body --> rum["Analytics + SpeedInsights (only when VERCEL=1)"]
    children --> bp["BreakpointProvider (client, initialIsMobile=false; matchMedia after hydration)"]
    bp --> appshell["AppShell (client chrome)"]
    appshell --> chrome["MatrixRainLazy (client-only) · CRTOverlay (6 layers) · DesktopTopbar · StatusBar+MobileTitleBar · Dock · ToTopButton · skip-link"]
    appshell --> main["PageMain (RSC): main#main-content"]
    main --> secs["ErrorBoundary-wrapped sections:<br/>Hero + About + Career + Modules (RSC)"]
    appshell --> footer["ErrorBoundary-wrapped Footer (RSC), after PageMain"]
    footer --> footerIslands["FooterLazy: direct client re-exports, session counters + halt/reboot"]
```

The motion bootstrap script is load-bearing: it reads `localStorage('erik.motion')` / OS preference and sets `body[data-motion]` **before first paint**, off the hydration path, so the initial motion preference does not wait for hydration.

## The rendering pipeline (RSC + PPR)

`cacheComponents: true` turns on Partial Prerendering. The mechanism in this codebase:

```mermaid
flowchart LR
    req["Request"] --> px["proxy.ts: add CSP + Reporting-Endpoints"]
    px --> shell["Prerendered shell:<br/>AppShell chrome + Hero (outside Suspense) + above-fold sections"]
    shell --> stream["Server streams"]
    stream --> susp["Suspense boundaries resolve per-request"]
    susp --> dyn["Independent ASK / PSI data reads"]
    dyn --> html2["Streamed HTML"]
    html2 --> hydrate["Browser hydrates chrome and client islands"]
    hydrate --> lazy["Contact / Shell: next/dynamic, ssr:false<br/>Footer islands mount directly"]
```

**Static vs dynamic, concretely:**
- **Static (prerendered):** `AppShell` chrome except the client-only MatrixRain canvas, `Hero` (outside Suspense so LCP never waits), `About`, `Shell`, the responsive `Guitar` presentation, Projects with its attached receipts, `DawMixer`, Contact with its work-authorization table, and section fallbacks. Projects uses one RSC tree with CSS controlling the responsive grid. `DawMixer` uses one synchronous RSC layout at every width; its interactive islands hydrate on phones too. The Visa table renders once and CSS adapts it.
- **UA-selected variants:** none on `/`. `getIsMobile()` (`lib/ua.ts`, which reads `headers()`) is available for a future dual-variant section.
- **Measured data:** `AiMetricsSection` renders the `sec-live-metrics` module. It composes `AiMetricsData` and `LivePerfSection`, with independent Suspense boundaries for ASK, desktop PSI and mobile PSI. Each fallback retains its metric layout and shows a loading state. Receipts remain inside Projects rather than a separate module.
- **The dual-variant pattern** (available, unused on `/`):

  ```
  <Module><Suspense fallback={<Desktop/>}><AsyncInner/></Suspense></Module>
  ```

  `AsyncInner` awaits `getIsMobile()` and renders a desktop or mobile variant, with the desktop variant as the fallback. `GuitarSection`, `DawMixerSection` and `VisaContent` use one responsive presentation without this UA boundary or variant swap.
- **`defer` prop:** the below-the-fold sections (`DEFERRED_SECTION_COUNT` in `components/responsive/Module/module.constants.ts`, held by `__tests__/content-visibility.test.ts`) pass `defer` to `Module`, which applies CSS `content-visibility` (defers render cost, not JS). Most use `Module`; Career applies the same attributes in its own wrapper.
- **`next/dynamic` boundaries:** `ContactFormLazy` and `InteractiveShellLazy` use `ssr: false` with accessible loading placeholders. `MatrixRainLazy` loads from `AppShell` with `ssr: false` as a decorative fixed overlay behind `main`; late hydration cannot shift layout. `Footer` is an RSC: content, cards, sitemap and shutdown log render on the server. `FooterLazy.client.tsx` directly re-exports session counters and halt/reboot controls from `Footer.client`, without a dynamic import; the netstat card uses the design-system `CopyButton` island. Counters start at mount to include commands before the footer is reached. The halt clock is empty on the server and reads the visitor’s clock after mount.

The terminal home combines prerendered output and dynamic Suspense children. Separately, `lib/links/feed.ts` uses `use cache` and `cacheLife` for the YouTube feed: stale after 900 seconds, revalidate after 3,600 seconds, expire after 86,400 seconds. `LinksPage` awaits that feed and falls back to `EMPTY_FEED` on failure.

## End-to-end data flow #1 - page render (read path)

```
build time:  content/*.ts imported -> Zod parse (gate) -> typed data baked into RSC output
eval run:    scripts/ask-eval.ts -> Redis ask:eval:latest
request:     proxy.ts headers -> static shell streamed -> getIsMobile() resolves per request
             -> section variants and independent ASK / PSI reads stream -> client hydrates islands
```

The content layer is build-time: static copy is already in the prerendered output. Measured reads live data through `lib/ask-metrics.ts` and `lib/lighthouse-scores.ts`. PSI uses its Redis cache and may fetch PageSpeed Insights when the cache is missing. Projects does not read the user agent or wait on live data.

## End-to-end data flow #2 - `/api/ask` (the streaming AI feature)

Transport is **plain `fetch` reading a raw `ReadableStream` of `text/plain`** - not SSE, and the AI SDK runs server-side only.

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
    U->>U: parseStreamChunk -> rAF-coalesced setStreamingText (React state owned by InteractiveShell)
    R->>KV: finally: settleBudget(refund) + Layer-2 audit + ask-log (fail-quiet)
    U->>U: finalize() -> commit answer (or error line) into history
```

**Client-side rendering nuance (verified in code):** the streamed text lands in an _isolated_ `streamingText` state and is flushed at most once per animation frame (`requestAnimationFrame`), so chunks within one frame share a state update. The state lives in `InteractiveShell`, whose component renders again when it changes; the text is displayed in a dedicated span. This is the opposite of the Hero boot loop, which mutates `textContent` directly with no React state (see doc 04). Both limit update work.

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

At 04:00 UTC daily (`0 4 * * *`), `/api/contact-retry` checks the `CRON_SECRET` bearer before reading pending ids in received-time order. Messages older than 7 days, or already at 3 retry attempts, leave the outbox. Each eligible message consumes an attempt before calling the same delivery function. Successful sends leave the outbox; failures remain pending. Audit messages retain their 90-day KV TTL. The success response is `{ ok: true, requestId, data: { sent, failed, expired, exhausted } }`, with a matching `X-Request-Id` header. Contact logs carry only `requestId` and `msgId`.

## Request lifecycle summary (every request)

```mermaid
flowchart LR
    e["Edge"] --> p["proxy.ts<br/>CSP + Reporting-Endpoints<br/>(skips _next/static, images)"]
    p --> n["next.config.ts static headers<br/>COOP · XFO · HSTS · nosniff"]
    n --> route{route type}
    route -->|page| ppr["PPR: static shell + streamed dynamic sections"]
    route -->|api| handler["defineHandler or bespoke streaming handler"]
    handler --> failopen["rate limits fail open; ask budget reservation fails closed<br/>defineHandler responses carry X-Request-Id"]
```
