# Mobile Responsive Layout — Design Spec
**Date:** 2026-05-14  
**Status:** Approved  
**Scope:** `erikunha.com.br` — same URL, fully responsive at 768px breakpoint

---

## 1. Delivery model

Single URL, single Next.js route (`app/page.tsx`). CSS breakpoint at `768px`:
- `≤768px` = mobile layout
- `≥769px` = desktop layout (current behaviour preserved)

No separate `/mobile` route. No user-agent detection.

---

## 2. Layout structure

### Mobile render order (top → bottom)

```
<MobileStatusbar />          sticky top, z-index 110
<MobileAppbar />             sticky z-index 109, RSC
<Topbar />                   desktop-only (display:none ≤768px)
<main>
  <HeroSection />            desktop-only (display:none ≤768px)
  <SectionReveal> × 19       wraps every RSC section
</main>
<FooterSection />
<MobileDock />               fixed bottom, mobile-only
<MobileTotop />              floating ↑, mobile-only
```

### Hero on mobile
`HeroSection` is hidden on mobile (`display:none ≤768px`). No mobile hero is implemented at this stage — deferred to a future spec.

### All 19 sections included
Every desktop section is present on mobile, wrapped in `SectionReveal`. No sections are omitted or combined.

---

## 3. SectionReveal — core animation component

**File:** `components/client/section-reveal.client.tsx`  
**Type:** Client component ('use client')  
**Used in:** `app/page.tsx`, wrapping every RSC section

### Props

```typescript
interface SectionRevealProps {
  id: string;             // DOM id, used by MobileDock for scroll targets
  label: string;          // Mobile accordion header label (e.g. "CAT README.MD")
  icon: React.ReactNode;  // SVG icon for mobile accordion header
  defaultOpen?: boolean;  // Mobile accordion initial state (default: true)
  children: React.ReactNode; // RSC section content
}
```

### Behaviour — animation (desktop + mobile)

**Mount:**
1. Read `el.offsetHeight` from the wrapper div (SSR-rendered height, fonts already loaded via `next/font/local`).
2. Set `style.minHeight = height + 'px'` — locks layout height for the page lifetime. Prevents CLS during type-in and backspace animations.
3. Walk all DOM text nodes via `TreeWalker(NodeFilter.SHOW_TEXT)`, **skipping** subtrees rooted at: `[data-no-reveal]`, `input`, `textarea`, `button`, `canvas`, `[aria-hidden="true"]`, `script`, `style`.
4. For each collected text node: store `{ node, original: node.textContent }`. Replace `node.textContent` with a string of spaces of equal length — layout holds, text invisible.
5. Remove the `reveal-mask` CSS class from the wrapper (the class was applied server-side via the `className` prop, holding `opacity: 0` until client is ready — prevents the "SSR text → blank → retype" flash on slow connections).
6. Register one `IntersectionObserver` per section (threshold `0.1` for entry, `0` for exit).

**State machine:**

```
IDLE → TYPING → TYPED → ERASING → IDLE
```

- Any IO entry event while in ERASING → immediately transition to TYPING (continue from current char position).
- Any IO exit event while in TYPING → immediately transition to ERASING.
- Cancels the current `requestAnimationFrame` handle before transitioning.

**Type-in animation (TYPING state):**
- Flatten all `{node, original, currentLen}` records into a single ordered character list.
- Each `rAF` frame: advance `N` characters. `N = Math.max(1, Math.floor(totalChars / 15))` — scales so total animation runs ~250ms at 60fps.
- For each character revealed: 1–2 frames show a random matrix glyph (`KATAKANA + 0-9 + A-F` set) before resolving to the actual character.
- Set `aria-busy="true"` on wrapper during animation; remove on completion.

**Erase animation (ERASING state):**
- Reverse order through the same character list.
- Same per-frame `N`, same speed.
- Replace chars with spaces (not empty string — preserves text node layout contribution).
- Remove `aria-busy` on completion.

**Reduced motion:** `window.matchMedia('(prefers-reduced-motion: reduce)')` — skip animation entirely, show final text immediately, never set `aria-busy`.

### Behaviour — mobile accordion

On mobile (`≤768px`):
- Renders a toggle button (`.mod-head`) above the section content.
- Toggle manages `open` state (`useState(defaultOpen)`).
- When `open === false`: section body is `display:none` (CSS class `.mod-body--closed`).
- When `open === true`: section body is visible; `SectionReveal` animation plays normally.
- `min-height` is only applied when `defaultOpen === true` or on desktop — collapsed sections get no `min-height` (avoids gap when collapsed).
- Exposes `data-section-id={id}` on the wrapper for `MobileDock` to target.

On desktop:
- Toggle button hidden via CSS.
- Body always visible (`display:block !important` at `≥769px`).
- `defaultOpen` prop ignored.

### Concurrent animation limit

A module-level `AnimationQueue` singleton caps concurrent active animations at **2**. New sections joining the queue while 2 are active wait until a slot frees. This prevents frame-rate drops when multiple sections enter the viewport simultaneously (e.g. initial page load on desktop).

### Nested client island protection

`ShellSection` and `ContactSection` contain client islands (`ShellClient`, `ContactFormClient`) that manage their own DOM. Their root elements carry `data-no-reveal="true"`. The `TreeWalker` skips these subtrees entirely — no conflict between `SectionReveal` and their internal state.

---

## 4. Mobile-specific components

### 4a. MobileStatusbar

**File:** `components/client/mobile-statusbar.client.tsx`  
**Type:** Client component  
**Visibility:** `display:none ≥769px` via `.mobile-only` CSS class

- Sticky top, `z-index: 110`.
- Live clock: `setInterval` every 15s, formats as `HH:MM`.
- Static cosmetic elements: signal bars (4 bars, last one at 50% opacity), "5G" label, battery box at 78%.
- `padding-top: calc(env(safe-area-inset-top, 0px) + 6px)` — notch-safe.
- `border-bottom: 1px solid var(--color-signal-dim)`.

### 4b. MobileAppbar

**File:** `components/sections/mobile-appbar.tsx`  
**Type:** RSC (no JS)  
**Visibility:** `display:none ≥769px` via `.mobile-only` CSS class

- Sticky, `z-index: 109`, below statusbar.
- Left: macOS traffic-light dots (red `#FF5F57`, yellow `#FEBC2E`, green `#28C840`), `aria-hidden`.
- Centre: "PORTFOLIO.SH" in signal-green, `font-weight: 700`.
- Right: "CV ↗" link → `/erik-cunha-cv.pdf`, `target="_blank"`.
- `border-bottom: 1px solid var(--color-signal-dim)`.

### 4c. MobileDock

**File:** `components/client/mobile-dock.client.tsx`  
**Type:** Client component  
**Visibility:** `display:none ≥769px` via `.mobile-only` CSS class

- Fixed bottom, `z-index: 120`, full-width.
- `padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 8px)` — home-bar safe.
- `backdrop-filter: blur(8px)` + `background: rgba(0,0,0,0.92)`.
- Five tabs:

| Tab | Label | Target id |
|-----|-------|-----------|
| Home | HOME | `sec-readme` |
| Work | WORK | `sec-projects` |
| Perf | PERF | `sec-perf-receipts` |
| Shell | SHELL | `sec-shell` |
| Hire | HIRE | `sec-contact` |

- On tap: `document.getElementById(id)?.setAttribute('data-open', 'true')` → expand if collapsed → `el.scrollIntoView({ behavior: 'smooth', block: 'start' })`.
- `IntersectionObserver` on all section wrappers (`[data-section-id]`): whichever section has `isIntersecting` and appears highest in the viewport gets the `.active` tab style.

### 4d. MobileTotop

**File:** `components/client/mobile-totop.client.tsx`  
**Type:** Client component  
**Visibility:** `display:none ≥769px` via `.mobile-only` CSS class

- Fixed bottom-right, above dock: `bottom: calc(72px + env(safe-area-inset-bottom, 0px) + 14px)`.
- Hidden until `window.scrollY > 400` (passive scroll listener).
- Appears/disappears via `opacity` + `translateY(8px)` CSS transition.
- On tap: `window.scrollTo({ top: 0, behavior: 'smooth' })`.

---

## 5. CSS additions (`app/globals.css`)

```css
/* Hydration-flash prevention — client removes this class on mount */
.reveal-mask { opacity: 0; }

/* Layout utilities */
.desktop-only { /* shown by default */ }
.mobile-only  { display: none; }

@media (max-width: 768px) {
  .desktop-only { display: none !important; }
  .mobile-only  { display: block; }   /* override per-component as needed */

  body {
    padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 8px);
  }

  /* Accordion */
  .mod-body--closed { display: none !important; }

  /* Mobile mod-head button */
  .mod-head { /* styled inline on MobileSection */ }
}

@media (min-width: 769px) {
  /* Desktop: accordion body always visible, toggle hidden */
  .mod-head  { display: none !important; }
  .mod-body--closed { display: block !important; }
}
```

---

## 6. Changes to existing files

### `app/page.tsx`
- Import and render `MobileStatusbar`, `MobileAppbar`, `MobileDock`, `MobileTotop`.
- Wrap each of the 19 RSC sections in `<SectionReveal id="..." label="..." icon={...} defaultOpen={...}>`.
- `HeroSection` wrapped in `<div className="desktop-only">` — hidden on mobile without a wrapper affecting its desktop layout.
- `Topbar` gets `className="desktop-only"`.

### `components/client/shell.client.tsx`
- Add quick-command chip row below the input (mobile UX improvement, visible on all viewports).
- Chips: `whoami`, `ls`, `cat skills.md`, `cat ~/.now`, `contact`, `hire`, `help`, `clear`.
- Root div gets `data-no-reveal="true"`.

### `components/sections/contact.tsx`
- Root element gets `data-no-reveal="true"` (passed down to `ContactFormClient`).

---

## 7. Explicitly out of scope

- Mobile hero section (deferred)
- Different boot sequence on mobile (deferred — requires its own spec)
- Tablet-specific breakpoint (768px handles both mobile and tablet adequately)
- Per-section animation speed tuning (use the adaptive formula; adjust post-launch)

---

## 8. Performance constraints (unchanged from CLAUDE.md)

| Metric | Budget |
|--------|--------|
| Client JS total (all islands) | < 43KB gzipped |
| LCP | < 1.8s on 4G |
| INP | < 200ms |
| Lighthouse Accessibility | = 100 |

`SectionReveal` + 4 mobile components add ~4–6KB gzipped. Budget holds.
