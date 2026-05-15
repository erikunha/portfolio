# Mockup Port — Design

**Date**: 2026-05-14
**Status**: Approved, ready for implementation plan

## Goal

Port two static HTML mockups into the existing Next.js / React project such that the rendered output is visually and behaviorally indistinguishable from the mockups.

**Mockup files** (source of truth):
- `~/Downloads/erik-portifolio - mobile/Portfolio.html` (desktop, ~140KB)
- `~/Downloads/erik-portifolio - mobile/Portfolio.mobile.html` (mobile, ~85KB)

**Non-goal**: maintaining alignment with the existing CLAUDE.md project rules (content discipline, performance budgets, JS budget, Lighthouse gates). User has explicitly overridden these for this port.

## Constraints (locked in during brainstorm)

| Decision | Value |
|---|---|
| Replace vs parallel | Replace existing implementation; delete old section/client/content files |
| API routes (`/api/contact`, `/api/ask`) | Untouched; forms and shell keep working |
| Responsive strategy | Single URL `/`; breakpoint-driven via hook, NOT separate routes or middleware rewrites |
| Feature wiring | Shell and contact form visually match mockup AND remain functional |
| Lighthouse / JS / a11y budget gates | Dropped |
| Section list | Desktop mockup is canonical; all 19 sections render on both viewports |
| Mobile default state | Everything open by default; module toggles still work for manual collapse |
| Section ordering | Desktop mockup order (README → MAN → NOW → PROJECTS → GIT_LOG → NPM → SYS_HEALTH → SHELL → LIVE_PERF → PERF_RECEIPTS → GUITAR → VISA → CREDENTIALS → COMMUNITY → HOTTEST_TAKES → RESPONSIBILITIES → UNKNOWNS → CONTACT) |
| Body color token | `--fg: #C8FACC` (matches mockup; overrides CLAUDE.md `#E6FFE6`) |
| Matrix rain | On by default, paused under `prefers-reduced-motion: reduce` |
| Content storage | Hard-coded inside JSX; no `content/*.ts` indirection |
| Component reuse | One component per section, shared by both viewports |

## Architecture

```
Request: GET /
  ↓
app/page.tsx (RSC)
  • reads headers() → initialIsMobile
  • renders <BreakpointProvider initialIsMobile={...}><Page/></BreakpointProvider>
  ↓
BreakpointProvider (client)
  • useState(initialIsMobile)
  • effect: matchMedia('(max-width: 768px)') listener
  • context: { isMobile }
  ↓
<Page/> (client)
  • const { isMobile } = useBreakpoint()
  • renders: CRTOverlay, MatrixRain, (StatusBar if mobile), Hero,
    19 sections, (Dock if mobile), Footer
```

The server reads UA from `headers()` to seed the initial breakpoint for correct SSR markup (avoids flash on mobile devices). After hydration, `matchMedia` takes over, so resizing a desktop browser to mobile width swaps the layout in real time.

UA misdetection (rare iPad / desktop-mode toggling) shows as a one-tick re-render after hydration — only the branches that depend on `isMobile` shift. Accepted trade-off.

## File layout

### Deletions (step 0)
```
app/page.tsx                                         (replaced)
components/sections/**/*
components/client/hero-boot.client.tsx
components/client/matrix-rain.client.tsx             (rewritten)
components/client/mobile-dock.client.tsx             (rewritten)
components/client/mobile-statusbar.client.tsx       (rewritten)
components/client/mobile-totop.client.tsx
components/client/section-reveal.client.tsx
components/client/motion-toggle.client.tsx
components/client/contact-form.client.tsx           (rewritten)
content/**/*
__tests__/section-reveal-utils.test.ts
```

### Survivals (no change)
```
app/layout.tsx
app/api/ask/route.ts
app/api/contact/route.ts
app/sitemap.ts
app/opengraph-image.tsx
lib/*                                                (validation, rate-limit, anthropic client)
public/erik-cunha-cv.pdf
public/fonts/* (JetBrains Mono)
```

### New tree
```
app/
  page.tsx                                           (RSC, reads UA, renders provider)
  globals.css                                        (rewritten: tokens, CRT layer, fonts)

lib/
  breakpoint.ts                                      (detectMobileFromUA(ua: string): boolean)
  use-breakpoint.ts                                  (provider + useBreakpoint hook)

components/
  Page.tsx                                           (client, top-level composition)
  shared/
    Hero.tsx                                         (branches: mobile = 2-CTA, desktop = boot sequence)
    ReadmeSection.tsx
    ManPageSection.tsx
    NowSection.tsx
    ProjectsSection.tsx                              (LS -LA ./PROJECTS)
    GitLogSection.tsx
    NpmStackSection.tsx                              (NPM LIST --GLOBAL)
    SysHealthSection.tsx
    ShellSection.tsx                                 (wraps <InteractiveShell/> island)
    LivePerfSection.tsx
    PerfReceiptsSection.tsx                          (-97.5% tiles)
    GuitarSection.tsx
    VisaSection.tsx
    CredentialsSection.tsx
    CommunitySection.tsx
    HottestTakesSection.tsx
    ResponsibilitiesSection.tsx
    UnknownsSection.tsx
    ContactSection.tsx                               (wraps <ContactForm/> island)
    Footer.tsx                                       (SESSION_REPORT + NETSTAT)
  responsive/
    Module.tsx                                       (breakpoint-aware section wrapper, accordion on mobile)
    StatusBar.tsx                                    (mobile-only, top, clock tick)
    Dock.tsx                                         (mobile-only, bottom sticky, smooth scroll)
    MatrixRain.tsx                                   (canvas + RAF loop)
    CRTOverlay.tsx                                   (scanlines/grain/flicker layer + reduced-motion gate)
  client/
    InteractiveShell.tsx                             (wires /api/ask)
    ContactForm.tsx                                  (wires /api/contact)
```

**Net**: ~22 new files, ~12 deletes, ~4 rewrites.

## Component contract

### `<Module>` — the responsive wrapper

```ts
interface ModuleProps {
  id: string;                  // e.g., "sec-readme"
  header: string;              // e.g., "CAT README.MD"
  defaultOpen?: boolean;       // default true for this project
  children: React.ReactNode;
}
```

On desktop: renders `<section id={id}><h2>{header}</h2>{children}</section>` — no toggle.

On mobile: renders `<section id={id} data-open={open}>` with a clickable header that toggles `open` state; ▸/▾ glyph; `aria-expanded` synced. Body hidden when `open === false`.

Toggled by either user click or by `<Dock/>` (which sets `data-open=true` programmatically before scrolling to the section).

## Section list

All 19 sections render on both viewports.

| # | ID | Header | Mobile default |
|---|---|---|---|
| 1 | `bio` | (hero) | always open |
| 2 | `sec-readme` | CAT README.MD | open |
| 3 | `sec-man-page` | MAN ERIK(1) | open |
| 4 | `sec-now` | CAT ~/.NOW | open |
| 5 | `sec-projects` | LS -LA ./PROJECTS | open |
| 6 | `sec-git-log` | GIT LOG ~/CAREER | open |
| 7 | `sec-npm-stack` | NPM LIST --GLOBAL | open |
| 8 | `sec-sys-health` | SYS_HEALTH_MONITOR | open |
| 9 | `sec-shell` | ./EXEC INTERACTIVE_SHELL | open |
| 10 | `sec-live-perf` | LIVE_PERF.JSON | open |
| 11 | `sec-perf-receipts` | PERF_RECEIPTS --HARD-NUMBERS | open |
| 12 | `sec-guitar` | CAT ~/.GUITAR_RIG | open |
| 13 | `sec-visa` | CAT ~/.VISA | open |
| 14 | `sec-credentials` | CAT ~/.CREDENTIALS | open |
| 15 | `sec-community` | CAT ~/.COMMUNITY | open |
| 16 | `sec-hottest-takes` | CAT ~/HOTTEST_TAKES.MD | open |
| 17 | `sec-responsibilities` | LS -LA ~/RESPONSIBILITIES | open |
| 18 | `sec-unknowns` | CAT ~/.UNKNOWNS | open |
| 19 | `sec-contact` | SUDO CONTACT --INIT | open |
| – | `footer` | (shutdown sequence) | always visible |

Copy comes verbatim from `Portfolio.html` at each section's matching block. Any drift from the mockup is a bug.

## Visual effects layer

```
z-index ladder (top to bottom)
  page content                       z: 10
  ─────────────
  scan beam (1px sweep, 8s loop)     z: 5
  flicker (opacity 0.04, ~0.3s)      z: 4
  RGB sub-pixel mask                 z: 3
  scanlines (2px, opacity 0.06)      z: 2
  grain (data URI noise, 0.08)       z: 1
  matrix rain canvas                 z: 0
  pure black background (#000)       z: -1
```

**Tokens** (in `globals.css`):
```css
:root {
  --signal:      #00FF41;
  --signal-dim:  #00FF4133;
  --fg:          #C8FACC;     /* matches mockup */
  --muted:       #4ADE80;
  --bg:          #000;
  --border:      rgba(0,255,65,0.2);
}
```

**Fonts**:
- JetBrains Mono via `next/font/local` (already in `public/fonts/`). CSS var `--font-mono`.
- Inter 900 via `next/font/google`. CSS var `--font-display`. Used only for the "THE MATRIX HAS YOU." headline.

**Reduced motion**: `<CRTOverlay/>` mounts a `prefers-reduced-motion` listener and toggles `body[data-motion="reduce"]`. Matrix rain canvas does not initialize when set. Flicker, scan beam, and grain animations pause via CSS selector. Static phosphor glow and scanlines remain (not animated).

## RSC vs client breakdown

| File | Type | Reason |
|---|---|---|
| `app/page.tsx`, `app/layout.tsx` | RSC | `headers()`, static shell |
| `lib/breakpoint.ts` | shared util | No React |
| `lib/use-breakpoint.ts` | client | Hook + provider |
| `components/Page.tsx` | client | Uses hook; everything below transitively client |
| `components/shared/*Section.tsx` | client | Wrapped by Page or Module |
| `components/responsive/*` | client | Hook + side effects |
| `components/client/*` | client | Form submission, fetch calls |

Net: only `app/page.tsx` + `app/layout.tsx` are RSC. Trade-off accepted (JS budget gate dropped).

## Data flow

**Forms**:
```
<ContactForm/>      ──submit──►  POST /api/contact   ──►  Resend
<InteractiveShell/> ──submit──►  POST /api/ask       ──►  Anthropic Haiku
```

Both endpoints untouched. Existing client-side Zod validation, rate-limit feedback, and error states are kept — just re-skinned to the terminal aesthetic (`user@terminal:~$ enter_email`, `EXECUTE_SEND`, `waiting for manual override... _`, etc.).

## Build order

11 commits, screenshot-verify between each against the mockup at both viewports.

| Step | Description |
|---|---|
| 0 | **Demolition** — delete old sections, client, content, tests |
| 1 | **Foundation** — breakpoint lib + hook, Page skeleton, CRTOverlay, globals.css tokens + CRT layer + fonts, app/page.tsx wired |
| 2 | **Hero** — both viewport variants |
| 3 | **Module wrapper** — verify accordion on mobile, plain section on desktop |
| 4a | **Static sections batch A** — README, MAN, NOW, NPM, SYS_HEALTH, LIVE_PERF, VISA, CREDENTIALS, COMMUNITY |
| 4b | **Static sections batch B** — HOTTEST_TAKES, RESPONSIBILITIES, UNKNOWNS, GUITAR |
| 5 | **Stat-heavy sections** — PROJECTS (drwxr-xr-x tiles), GIT_LOG (graph), PERF_RECEIPTS (-97.5%) |
| 6 | **Mobile chrome** — StatusBar + Dock |
| 7 | **Interactive islands** — InteractiveShell + ContactForm re-skinned, wired to existing APIs |
| 8 | **Footer** — SESSION_REPORT + NETSTAT + [SYSTEM HALTED] |
| 9 | **Matrix rain** — last, so we're not debugging canvas alongside typography |
| 10 | **Final sweep** — side-by-side at 1440 + 390 against mockup, patch drift |

Each step ends with: build, screenshot, eyeball-diff against mockup at both viewports, commit.

## Verification approach

The mockups are the spec. After each step:
1. Run dev server.
2. Open Playwright at 1440 and 390.
3. Take full-page screenshots of both live and mockup.
4. Visually compare side-by-side.
5. Patch drift before committing.

No unit tests added. The existing test `section-reveal-utils.test.ts` is deleted alongside its component.

Manual smoke at step 7: submit the contact form and ask the shell a question, confirm `/api/contact` and `/api/ask` still return successfully.

## Out of scope

- Lighthouse audits / Performance / Accessibility / SEO score targets.
- Bundle-size enforcement (the `bundle-check` script remains in the repo but no gate enforces it).
- Content extraction into `content/*.ts` modules with Zod validation.
- Unit tests for the new components.
- E2E tests beyond the manual smoke at step 7.
- i18n, light theme, or any feature explicitly listed as out of scope in CLAUDE.md.
- Vercel deployment / domain configuration changes.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| ASCII art (project tiles, git graph, NETSTAT box) misaligns at narrow widths | High | Step 5 + final sweep verify at 390. Use `white-space: pre` + monospace font lock. |
| Matrix rain regresses scroll perf on low-end mobile | Medium | Already gated by `prefers-reduced-motion`. Step 9 final commit lets us isolate if needed. |
| Hydration mismatch from UA misdetection | Low | Single re-render tick is the cost. Accepted. |
| Contact / shell re-skin breaks existing form validation | Medium | Keep all `useState` + Zod logic; only swap markup and class names. Smoke at step 7. |
| Mockup copy contains typos we replicate | Low | Copy is what the user pre-approved; treat as authoritative. |
| Inter 900 font flash | Low | `next/font/google` handles `display: swap` and preloads. |

## Acceptance criteria

The port is complete when, viewing `localhost:3000` in Playwright:
- At 1440x900, the rendered DOM text content matches `Portfolio.html` section-by-section.
- At 390x844, the rendered DOM text content matches all 19 sections (mockup ordering, not the mobile mockup's truncated 14).
- The contact form successfully posts to `/api/contact` and shows the existing success state.
- The interactive shell successfully POSTs to `/api/ask` and renders the Anthropic response.
- CRT effects render at both viewports; matrix rain renders behind content; reduced-motion disables animations.
- No console errors on initial load (Vercel Analytics CSP issue from prior commit is acceptable to defer).
