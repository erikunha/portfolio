# Components & State

> Component hierarchy, the section/island/primitive taxonomy, the design system, the CSS/token architecture, and the (deliberately minimal) state model.

## Component taxonomy

Four directories, four roles. The directory tells you the layer:

| Directory                     | Role                            | Ships JS?                                 | Example                                                            |
| ----------------------------- | ------------------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `components/sections/**`      | Page sections and nested groups | RSC, with client descendants where needed | `About`, `ProjectsSection`                                         |
| `components/client/**`        | Interactive islands             | Yes                                       | `InteractiveShell`, `ContactForm`, `ContactTimezone`, `DawMixer/*` |
| `components/responsive/**`    | Viewport chrome                 | Yes (except `Module`)                     | `MatrixRain`, `Dock`, `CRTOverlay`                                 |
| `design-system/components/**` | Reusable primitives             | Mostly No (RSC)                           | `Badge`, `Button`, `TerminalPanel`                                 |

`check-client-naming.mjs` accepts `*.client.tsx`/`*.client.ts`, files inside a `/client/` directory, and App Router error convention files. Inspect the client directive and imports when tracing a boundary. Components commonly use a `Foo/` directory and `index.ts` barrel. Vitest tests use `*.test.tsx`; component Playwright specs use `*.e2e.ts`. `*Lazy` files are code-split wrappers: `ContactFormLazy`, `InteractiveShellLazy` and `ContactTimezoneLazy` use `React.lazy` through `LazyIsland`, and `MatrixRainLazy` in `responsive/MatrixRain/` uses `next/dynamic` with `ssr: false` (consumed by `GlobalMotion` from the root layout).

The naming gate scans `app`, `components` and `lib`; `/client/` is an explicit directory-based exception.

`components/CompanyLink` renders every employer link: through `components/ExternalLink` (the shared `target="_blank"` and `rel="noopener noreferrer"` pair; `externalLinkProps(external)` spreads the pair onto a `Button` or a conditional anchor), a new-tab disclosure from `content/company-link.ts`, chosen by the required `locale` prop (an `sr-only` suffix, or `aria-describedby` to one shared note where the link sits inside a `data-type-reveal` heading, whose clip is sized from its text), a persistent underline and a 28px (`--spacing-target-compact`) hit area drawn by the `.company-link::before` pseudo-element. The hit area stays that small because the links sit inside dense inline text, where a 44px zone would cover the neighbouring lines and take their taps. `CompanyMention` links the company name inside an existing sentence and throws when the sentence stops naming it.

`Panel` (`design-system/components/Panel`) is the `.panel` frame (`.panel-head`, `.panel-marker`, `.panel-title`; marker, `h3` title, optional action) shared by About and Contact; `as` picks `div`, `section` or `aside`, `titleId` names the landmark, and `reveal` marks the heading for the app-wide `TypeReveal` island. The frame rules live in `app/css/components-panel.css`; a section scopes its own tweaks under its section class in its own partial. `components/PageMain` owns `MAIN_CONTENT_ID` and renders every `main#main-content` (home, reading views, error pages); `className` swaps its layout class. `components/reading/ReadingSection` and `ReadingActions` hold the section heading and the hire, secondary and print row that `/cv` and `/summary` share. `lib/defer-props.ts` returns the `module-deferred` class and `data-cv-defer` marker for a deferred section. `lib/json-ld.ts` `serializeJsonLd` escapes `<`, U+2028 and U+2029 so a value cannot end the script element it sits in.

`links-thumb` frames every `/links` video cover at 16:9 with the image filling the frame (no crop). The cover is grayscale under a multiplied signal-green layer from the `--links-thumb-*` tokens; hover or focus on the parent link restores the cover colour, and the transition stops while the MOTION switch is off. Documented with a live example in the design system components page.

The Hero identity line is static server-rendered text. Desktop and mobile share `HeroIdentity`, with metrics and accessible labels passed into `HeroStats`. `Hero` passes the boot and system-failure islands their copy for the page locale from `content/hero-client.ts` as props, so the client bundle carries one locale and server content validation stays out of it. The About "Open to [role] roles" status line mounts the `RoleTyper` client island (`components/client/RoleTyper`), which types the single role `Senior` over the server-rendered text. `About` contains Whoami, Now, Responsibilities, Stack and retry-code panels. Career (`sec-git-log`) owns the `cert/*`, `edu/*` and `community/*` tag groups; community content comes from `content/community.ts`.

Barrels beside `ContactFormLazy`, `InteractiveShellLazy` and `MatrixRainLazy` export only the lazy wrapper. `ContactTimezoneLazy` differs: it mounts on an intersection trigger, and its barrel also exports the server-rendered `ContactTimezoneStatic` that the lazy wrapper takes as its fallback. Tests import the real component directly, keeping it out of the initial client references. All three lazy wrappers render through `LazyIsland` (`ErrorBoundary` around `Suspense`), so a chunk that fails to load shows the fallback instead of a permanent loading state. A crashed island keeps its box: `ContactFormLazy` and `InteractiveShellLazy` pass a `minHeight` (named constants) that the default fallback applies as `--eb-min-height`, `ContactTimezoneLazy` keeps its server-rendered panel inside the `.ctz-host` that reserves the height, and the decorative CRT overlay in `AppShell` and Matrix rain in `GlobalMotion` use `fallback={null}` so a crash renders nothing. `useAskStream`, `AnimatedPlaceholder` and `ResponseReference` hold the shell's request, placeholder loop and reference copy. The pending answer shows an elapsed `[ thinking 1.2s ]` line, a block caret and `[ Esc ] stop` (Escape is handled on the shell wrapper only); failures print as `ask: <status>` stderr lines with a local fallback, a 429 with `Retry-After` becomes an ASCII countdown, and 15s of silence ends the request with a `[ RETRY ]` button. A failed or stopped question returns to the prompt only while the visitor has not edited the prompt since sending it, so text typed meanwhile, or a prompt emptied on purpose, is never refilled. `OfflineNotice` (in `AppShell`) fills a fixed `role=status` region while the browser is offline, and takes its copy resolved in `chrome.offline` so the client bundle holds one locale; `TerminalChromeBar` renders the shell and contact header; when the content gives a `mobileLabel` it renders both label variants and `max-md:hidden` / `md:hidden` pick one in CSS, so the bar has the same height before and after hydration.

## Component hierarchy

```mermaid
flowchart TD
    page["page frame: SiteHome · ReadingShell · LinksPage · design-system layout · NotFoundPage · RouteErrorPage"] --> siteshell["SiteShell (RSC)"] --> shell["AppShell.client"]
    shell --> navigation["SectionNavigationProvider (client): stable actions and copy, plus a store for current section, drawer and motion"]
    navigation --> rail["SectionNavigation (client): menu trigger, drawer focus trap and focus return<br/>Header: title and drawer close control"]
    navigation --> position["PositionMeter (client): decorative scroll progress line, aria-hidden, top from 1024px and right edge below"]
    navigation --> chrome["Chrome: CRTOverlay(6 layers) · DesktopTopbar · StatusBar · MobileTitleBar · Dock · ToTopButton"]
    page --> gm["GlobalMotion (mounted by RootShell in both root layouts): MatrixRainLazy (client-only) + TypeReveal"]
    shell --> main["PageMain (RSC): main#main-content"]
    main --> eb["ErrorBoundary"]
    eb --> sec["Terminal section (RSC)"]
    sec --> mod["Module (RSC wrapper: section + CSS typing header)"]
    sec --> dsp["design-system primitives: Badge · Button · CmdLine · Panel · StatTile · TerminalPanel · WindowChrome · KbdKey · BrandIcon · Field"]
    sec -. some host .-> isl["Islands: InteractiveShell · ContactForm · ContactTimezone · DawMixer{Fader,Knob,Vu,Rms} · HeroBoot · RoleTyper"]
    eb --> hero["Hero (RSC with boot and system-failure islands, owns its section)"]
    hero --> identity["HeroIdentity: shared desktop/mobile identity, actions and HeroStats props"]
    hero --> clientcopy["Boot + system-failure islands: typed hero-client copy"]
    eb --> career["Career (GitLogSection): own section and header"]
    eb --> about["About (RSC with RoleTyper island, owns its section)"]
    about --> scroll["Responsibilities + retry code: named keyboard scroll regions"]
    shell --> fl["ErrorBoundary-wrapped Footer (RSC): cards, sitemap, shutdown log"]
    fl --> fi["Footer.client: session counters + halt/reboot island + last-request receipt"]
    fl --> fc["Netstat endpoint cells: outbound links with a glyph"]
    links["/links and /links/en"] --> tagline["TaglineTyper: localized tagline cycle"]
```

### The section drawer

The section menu is a modal drawer at every width. It opens from the icon-only menu trigger (`Open menu`) or the dock `MENU` control, keeps Tab inside the panel, and closes on Escape, the close control or the scrim. Closing it returns focus to the control that opened it. A viewport change can stop that control from being rendered (the dock is `display: none` from 1024px), and focusing an element in a `display: none` subtree is a no-op. In that case the drawer falls back to the first rendered menu trigger. Focus always lands on a control the visitor can see.

### The `Module` wrapper

`components/responsive/Module/Module.tsx` (RSC) wraps terminal modules. Hero, About, Career and Footer render separately. It renders a `<section id tabIndex={-1} aria-labelledby>` containing a non-interactive `<header>` with an `<h2>`; there is no collapse affordance on any viewport. The `<h2>` reads the section name, the icon and the typed command; every module passes `name`. Props: `id`, `header`, `mobileHeader?`, `srLabel?`, `name?`, `icon?`, `defer?`, `variant?: 'green'`. The `defer` prop still drives `content-visibility` deferral via `data-cv-defer`/`module-deferred`. `content/section-labels.ts` supplies readable labels. It derives the registry labels and adds the scroll region labels.

Module headers use CSS scroll-driven typing with a stepped text reveal and caret. The caret blinks four times, then stays solid. Unsupported browsers and the MOTION switch off show static text. The text remains in the DOM and accessibility tree; no client JavaScript is added. `html` and `body` use `overflow-x: clip` so the view timeline follows page scrolling.

### CRT overlay layering

`CRTOverlay.client.tsx` renders 6 fixed, `aria-hidden`, `pointer-events:none` overlay divs, z-stacked in `crt.css` by the `--z-crt-*` steps of the `--z-*` scale in `theme.css`: vignette (1) · scanlines (2) · RGB sub-pixel mask (3) · noise and flicker (4) · scan beam (5). `MatrixRain` sits at `--z-rain` (0), `<main>` at `--z-content` (10). The CRT colors derive from theme tokens (`color-mix` over the palette plus the `--color-crt-phosphor-*` primaries), and the rain reads `--color-rain-head`, `--color-rain-body` and `--rain-tail-alpha` through `readRainPalette`. All of it disables under `body[data-motion="reduce"]`, and freezes during the system-failure overlay (`html.sysfail-on`). `CRTOverlay` also runs the frame governor (`lib/frame-governor.ts`): while `html[data-crt-level]` is above 0, `crt.css` pauses the noise, flicker and beam and the governor steps their clocks (`lib/crt-effect-stepper.ts`); `MatrixRain` reads the same level for its tick interval.

## The design system

Eleven primitives in `design-system/components/` (ten server components, one client); **nine exported** from `design-system/index.ts` (`Field` uses a direct import in `ContactForm` and the docs; `BrandIcon` is imported by path, because a barrel export kept its path data in the client chunks of seven routes and pushed `/` past the first-load budget). The docs also provide the client `CopyButton` under `app/(en)/design-system/_components/`.

| Primitive       | Type       | Variant surface                                                                |
| --------------- | ---------- | ------------------------------------------------------------------------------ |
| `Badge`         | RSC        | `variant: default｜dot`, `size: sm｜md`                                        |
| `BrandIcon`     | RSC        | inline SVG brand mark, `size` px wide, `currentColor` fill, `aria-hidden`      |
| `Button`        | RSC        | polymorphic `as: button｜a`, `variant: primary｜secondary`, `size: sm｜md｜lg` |
| `CmdLine`       | RSC        | terminal command line (`user`, `command`, `output`, `prompt`)                  |
| `Field`         | **client** | input/textarea + label + error/ARIA (not exported)                             |
| `KbdKey`        | RSC        | `size: sm｜md`                                                                 |
| `NavItem`       | RSC        | navigation link with `current` state and decorative `index`                    |
| `Panel`         | RSC        | framed section panel, `as: div｜section｜aside`, marker, `h3` title, optional action |
| `StatTile`      | RSC        | `<dl>` stat tile, `variant: default｜compact｜display`                         |
| `TerminalPanel` | RSC        | bordered container, polymorphic `as`, optional header                          |
| `WindowChrome`  | RSC        | macOS traffic-light dots for panel headers, `size` px                          |

Design-system primitives join class names with `lib/cn.ts`, which imports `clsx` and not `tailwind-merge`: a base class list and a variant list never set the same property (`__tests__/design-system-class-conflicts.test.tsx` fails when they do), because without a merge the stylesheet order, not the call order, picks the winner. The **DS docs site** (`app/(en)/design-system/**`) is MDX; `_lib/theme-tokens.ts` parses `app/css/theme.css` with the _same regex_ as `scripts/contrast-check.mjs`, to read the same token declarations. Changes to either parser still need checking. The changelog page is git-generated by `scripts/sync-changelog.ts` (`pnpm changelog:sync`), grouped by date under Added, Changed and Fixed with an ON THIS PAGE list of its dates. Every DS page carries that list; below 768px it follows the intro.

## CSS / token architecture

Import order (`app/globals.css`): `tailwindcss` → `theme.css` → `base.css` → `crt.css` → `animations.css` → `components-*.css` (flat partials, imported in the cascade order) → `forced-colors.css`. That `@import` order is the cascade order, and it is the only place it is recorded: the stylesheet-reading test helper (`__tests__/helpers/components-css.ts`) derives the partial order from these `@import` lines rather than sorting filenames, so a stylesheet assertion sees the same cascade the browser resolves. Tailwind v4 via the single `@tailwindcss/postcss` plugin. No CSS modules, no Style Dictionary.

| File               | `@layer`     | Holds                                                                                                                              |
| ------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `theme.css`        | `@theme`     | The token system (below)                                                                                                           |
| `base.css`         | `base`       | resets, focus-visible rings, skip-link, `.sr-only`, `.mobile-only`/`.desktop-only`                  |
| `crt.css`          | `components` | the 6 CRT classes + keyframes + MOTION-off disables + the `html[data-crt-level]` pause rule                                    |
| `animations.css`   | -            | section keyframes (`boot-blink`, `guitar-scan-beam`, `hero-shake-*`, ...)                                          |
| `components-*.css` | `components` | named layout and effect classes (`.module-*`, `.signal-glow`, DawMixer `.mx-fader`/`.mx-dial`, `.contact-*`, `.shell-cursor`, ...) |
| `forced-colors.css` | `components` | one `@media (forced-colors: active)` block, imported last: hides the CRT overlays and aria-hidden canvases, gives state-carrying controls system-color borders and outlines, and ends with an `!important` block that outranks Tailwind utilities (focus ring, primary and current buttons, pressed toggles, meter fills) |

**Tokens (`@theme`):** three ordinal color ramps (primary/secondary/tertiary, each 50 to 900) plus the status exception (`senary-300` alerts, `senary-500` and `quinary-500` window-chrome dots), with the brand palette mapped onto specific stops: `--color-primary-500: #00ff41` (signal green), `--color-secondary-950: #000000` (surface black), `--color-tertiary-50: #e6ffe6` (body text). Fixed-opacity stops (`-subtle` 40%, `-border` 20%, `-faint` 12%, `-quiet` 10%) are kept as explicit hex (byte-identical, no `color-mix`). **No raw hex outside `theme.css`** - enforced by `lint:css-tokens` (see doc 06/07).

## State architecture

This is a near-static site; the state model is intentionally tiny. Four mechanisms, in order of how much you'll touch them:

```mermaid
flowchart TD
    subgraph ctx["1. React contexts"]
        navigation["SectionNavigationProvider / useSectionNavigation<br/>stable actions, copy and chrome<br/>current section, drawer and motion live in a store read with useSyncExternalStore"]
        navigation --> consumers["SectionNavigation · DesktopTopbar · Dock · MobileTitleBar · ToTopButton"]
    end
    subgraph dom["2. DOM-as-state (motion)"]
        motion["lib/motion.ts: body[data-motion] + localStorage('erik.motion')<br/>broadcast via 'motionchange' CustomEvent"]
        w1["writers: DesktopTopbar (MOTION: ON / OFF toggle, xl tier)<br/>SectionNavigation drawer (MOTION: ON / OFF row, every width)"] --> motion
        motion --> r1["subscribers via lib/motion-change.ts: MatrixRain · RoleTyper · TypeReveal · HeroBootAnimation<br/>readers on mount: InteractiveShell placeholder"]
    end
    subgraph bus["3. Window CustomEvent bus (lib/events.ts)"]
        ev["motionchange · shell-cmd-run · hero:sysfail:show|hide · sysfail:start|end"]
    end
    subgraph local["4. Per-island local state"]
        li["each island owns useState/useRef<br/>one exception: ContactForm + ContactTimezone<br/>share the module-level messageStore"]
    end
```

**There is no state-management library, no `useReducer`, and no URL/`searchParams` state.** The router reads in the app are `usePathname()` in the design-system `Sidebar.client.tsx`, in `DesktopTopbar` (which marks the current page in the site navigation) and in the global `TypeReveal` (mounted on every route by `GlobalMotion`). Section navigation shares state through `SectionNavigationProvider`: its context value (actions, copy, chrome, locale and the store) never changes after the first render, and the current section, the drawer and the motion state live in a small external store that `useCurrentSection`, `useDrawerOpen` and `useMotionOn` read with `useSyncExternalStore`, whose server snapshot is the initial state. The viewport is read with `useBreakpoint`, a `useSyncExternalStore` hook over `matchMedia` whose server snapshot is desktop; it has no provider, because a context value that changes after hydration forces every dehydrated Suspense boundary below it, the lazy shell and the contact form included, to discard their server DOM and client-render. The same rule is why the navigation provider keeps scroll, drawer and motion state out of its context value; text typed into the server-rendered fields before an island hydrates stays in the kept DOM, and the island adopts it into its state on mount. Other cross-island coordination uses window `CustomEvent`s. For example, `InteractiveShell` dispatches `shell-cmd-run` and the `Footer.client` session counter listens to increment a counter, with no shared parent state.

### Per-island state, and the two rendering disciplines

Islands fall into two camps, and the split is a deliberate INP strategy:
- **Render _through_ React (rAF-coalesced state):** `InteractiveShell` - the streamed `/api/ask` answer lands in an isolated `streamingText` state flushed once per `requestAnimationFrame`. This is the one place per-token updates go through React, and coalescing limits component state updates to animation frames. A dedicated span displays the text, but the state belongs to `InteractiveShell`.
- **Mutate the DOM directly (no per-frame React state):** the Hero boot loop (`HeroBootAnimation` → `lib/boot-animation.ts`) and `RoleTyper` use `node.textContent =` typewriter mutation with `setTimeout`, **never** per-character `useState`. The DAW faders/knobs/VU meters update `style`/`setAttribute`/`className` directly on drag. `FaderDbIsland` and `VuMeter` hold no React state at all.

Keep animation and drag updates off per-character React state. Streaming text is the exception: `InteractiveShell` coalesces React state updates with requestAnimationFrame. See its behavioral tests and doc 09.

Other islands hold ordinary local state: `ContactForm` (a `idle→submitting→success｜queued｜error` status machine in the `useContactSubmit` hook, which owns the field errors, the request error, the receipt and the one-request-at-a-time guard, plus a honeypot, read out through one polite `role="status"` line that says waiting, sending, which fields are marked, or that the send failed; the message field is not local: it lives in `messageStore`, a module-level string store read with `useSyncExternalStore`, so `ContactTimezone` can append a proposed slot without prop drilling and typing re-renders only the form; the form resets the store after a delivered or queued send), `ContactTimezone` (the chosen zone, the proposed line, a boolean `useSyncExternalStore` read of whether that line is still in the message so the confirmation ends on a send or a deletion, and a `useNow` clock that ticks only while the panel is on screen and the tab is visible; the map, overlap and pin layout are memoised on the current minute), `ToTopButton` (`visible` on scroll>400), `StatusBar` and the `Footer.client` uptime counter (interval clocks with `visibilitychange` pause), the `Footer.client` halt clock (visitor time captured once after mount), `RmsButtons` (`Set<string>` toggle group), `CopyButton` (transient "COPIED"), the request-ref store (`lib/request-refs.client.ts`: this tab's request ids in `sessionStorage`, capped, with an in-memory fallback when storage throws, read through `useSyncExternalStore` by the shell `privacy` command and the footer receipt; only answers the server accepted and delivered or queued contact messages are recorded, and a confirmed forget removes the id).
