# Mobile Responsive Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six mobile layout regressions identified by comparing phone screenshots with Playwright captures at 390×844 viewport.

**Architecture:** Each fix is isolated — CSS or single-component change. Pattern already established: `readme--desktop`/`readme--mobile` CSS classes + conditional RSC rendering. Follow that pattern everywhere. No new abstractions.

**Tech Stack:** Next.js 15 App Router · React 19 · Tailwind (unused here — these components use plain CSS modules in `app/css/`) · JetBrains Mono · TypeScript strict

---

## Issues catalogue (from phone screenshots vs Playwright captures)

| # | Section | Issue | Root cause |
|---|---------|-------|-----------|
| 1 | NETSTAT -AN | State/Endpoint header and row cells misalign | Space-padded `<pre>` — colored `<span>` breaks monospace alignment |
| 2 | CAT README.MD | Mobile version is too sparse (8 lines vs desktop's 20+) | `README_MOBILE` array deliberately trimmed but never expanded |
| 3 | Hero boot sequence | Label reads `[BOOT SEQUENCE — MOBILE]` — ugly + contains banned em dash | Hardcoded string in `MOBILE_LINE_SPECS` |
| 4 | MAN ERIK(1) OPTIONS | `pre-wrap` on mobile makes space-indented lines wrap with ugly deep indent | `@media (768px) { white-space: pre-wrap }` fights hardcoded space columns |
| 5 | GIT BLAME --CAREER | `.blame-body` text at right edge overlaps ToTopButton (40px×40px at `right:14px`) | No right padding on blame container vs fixed button |
| 6 | Footer bottom | `shutdown-copy` bottom of footer has only 24px body padding — may clip behind dock on devices where safe-area is non-zero | `footer.shutdown` padding-bottom too tight on mobile |

---

## File map

| File | Changes |
|------|---------|
| `components/sections/Footer.tsx` | Replace space-padded `<pre>` NETSTAT with CSS-grid div |
| `app/css/_footer.css` | Add `.ns-grid` styles, fix mobile footer bottom padding |
| `components/sections/ReadmeSection.tsx` | Expand `README_MOBILE` array with Core Stack + Principles + Status |
| `components/sections/Hero.tsx` | Fix `MOBILE_LINE_SPECS[0]` label |
| `components/sections/ManPageSection.tsx` | Add `<div className="manpage--mobile">` with dl-based OPTIONS |
| `app/css/_sections.css` | Add `.manpage--mobile` styles, toggle desktop/mobile display |

---

## Task 1 — NETSTAT column alignment

**Files:**
- Modify: `components/sections/Footer.tsx:195-251`
- Modify: `app/css/_footer.css` (add after `.sd-netstat a:hover {}`)

### Problem

```
State        Endpoint        ← header uses raw spaces
EST  github.com/erikunha    ← EST is a <span>; browser may kern differently
```

The colored `<span>` inside a `<pre>` breaks monospace column alignment across font weights. CSS grid eliminates this.

- [ ] **Step 1: Replace mobile NETSTAT pre with ns-grid div in Footer.tsx**

Find the mobile branch of the NETSTAT section (lines 195-222). Replace:

```tsx
// BEFORE (lines 195-222)
{isMobile ? (
  <pre>
    <span className="ns-hdr">{'State        Endpoint'}</span>
    {'\n'}
    <span className="ns-est">{'EST'}</span>
    {'  '}
    <a href="https://github.com/erikunha" target="_blank" rel="noopener noreferrer">
      {'github.com/erikunha'}
    </a>
    {'\n'}
    <span className="ns-est">{'EST'}</span>
    {'  '}
    <a href="https://linkedin.com/in/erikunha" target="_blank" rel="noopener noreferrer">
      {'linkedin/erikunha'}
    </a>
    {'\n'}
    <span className="ns-listen">{'LSN'}</span>
    {'  '}
    <a href="mailto:erikhenriquealvescunha@gmail.com">
      {'erikh…@gmail.com'}
    </a>
    {'\n'}
    <span className="ns-est">{'EST'}</span>
    {'  '}
    <a href="https://erikunha.dev" target="_blank" rel="noopener noreferrer">
      {'erikunha.dev'}
    </a>
  </pre>
) : (
```

Replace with:

```tsx
// AFTER
{isMobile ? (
  <div className="ns-grid">
    <span className="ns-hdr-cell">State</span>
    <span className="ns-hdr-cell">Endpoint</span>
    <span className="ns-est">EST</span>
    <a href="https://github.com/erikunha" target="_blank" rel="noopener noreferrer">
      github.com/erikunha
    </a>
    <span className="ns-est">EST</span>
    <a href="https://linkedin.com/in/erikunha" target="_blank" rel="noopener noreferrer">
      linkedin/erikunha
    </a>
    <span className="ns-listen">LSN</span>
    <a href="mailto:erikhenriquealvescunha@gmail.com">
      erikh…@gmail.com
    </a>
    <span className="ns-est">EST</span>
    <a href="https://erikunha.dev" target="_blank" rel="noopener noreferrer">
      erikunha.dev
    </a>
  </div>
) : (
```

- [ ] **Step 2: Add ns-grid CSS to _footer.css**

After the `.sd-netstat a:hover {}` block (line ~125), add:

```css
.ns-grid {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 0 12px;
  font-family: var(--font-mono-stack);
  font-size: 12.5px;
  line-height: 1.95;
  color: var(--fg);
}
.ns-hdr-cell {
  color: var(--muted);
  letter-spacing: 0.06em;
}
.ns-grid .ns-est,
.ns-grid .ns-listen { font-weight: 700; }
.ns-grid a {
  color: var(--fg);
  text-decoration: underline;
  text-decoration-color: var(--signal-dim);
  text-underline-offset: 2px;
}
.ns-grid a:hover {
  text-decoration-color: var(--signal);
  text-shadow: 0 0 8px rgba(0,255,65,0.4);
}
@media (max-width: 900px) {
  .ns-grid { font-size: 11.5px; }
}
```

- [ ] **Step 3: Verify with Playwright at 390px**

Start dev server. Navigate to `http://localhost:3000`. Scroll to footer. Take screenshot and confirm State/Endpoint columns are aligned.

- [ ] **Step 4: Commit**

```bash
git add components/sections/Footer.tsx app/css/_footer.css
git commit -m "fix(footer): replace space-padded netstat pre with css grid for alignment"
```

---

## Task 2 — README mobile content expansion

**Files:**
- Modify: `components/sections/ReadmeSection.tsx:24-38` (the `README_MOBILE` array)

### Problem

Mobile README only has a brief intro (8 lines). Desktop has Core Stack, Operating Principles, Current Status sections. The hiring artifact needs this info on mobile too — it's the first section recruiters see.

- [ ] **Step 1: Expand README_MOBILE array in ReadmeSection.tsx**

Replace the existing `README_MOBILE` array (lines 24-38):

```tsx
// BEFORE
const README_MOBILE: ReadmeLine[] = [
  { text: '# erik cunha', cls: 'h2' },
  { text: ' ' },
  { text: 'full-stack engineer (frontend-heavy).' },
  {
    node: (
      <>{'currently shipping the '}<span className="pill">{'betsson'}</span>{' cashier — 40M+ tx/yr,'}</>
    ),
  },
  { text: '€1B+ annual revenue, PCI-DSS, micro-frontends.' },
  { text: ' ' },
  { text: '## what i do', cls: 'h1' },
  { text: "build regulated, high-traffic frontends that don't break" },
  { text: 'when finance / health / commerce regulators show up.' },
];
```

Replace with:

```tsx
// AFTER
const README_MOBILE: ReadmeLine[] = [
  { text: '# erik cunha', cls: 'h2' },
  { text: ' ' },
  { text: 'full-stack engineer (frontend-heavy). 8+ yrs.' },
  {
    node: (
      <>{'shipping the '}<span className="pill">{'betsson'}</span>{' cashier — 40M+ tx/yr,'}</>
    ),
  },
  { text: 'PCI-DSS, micro-frontends, €1B+ annual revenue.' },
  { text: ' ' },
  { text: '## core stack', cls: 'h2' },
  { text: '- Angular · React/Next.js · TypeScript · Node.js · RxJS' },
  { text: '- Micro-frontends · Nx · Clean Architecture' },
  { text: ' ' },
  { text: '## operating principles', cls: 'h2' },
  { text: '- Performance-first: LCP, TBT, bundle reduction in prod.' },
  { text: '- A11y & compliance: WCAG 2.1 AA, PCI-DSS.' },
  { text: ' ' },
  { text: '## status', cls: 'h2' },
  {
    node: (
      <>{'open to '}<span className="pill">{'[senior / staff / principal]'}</span>{' roles.'}</>
    ),
  },
  { text: 'remote-first · EU/US/CA · English C1.' },
];
```

- [ ] **Step 2: Verify line numbers render correctly in Playwright**

Scroll to CAT README.MD section at 390px. Confirm gutter numbers count correctly and all sections are visible.

- [ ] **Step 3: Commit**

```bash
git add components/sections/ReadmeSection.tsx
git commit -m "fix(readme): expand mobile content with core stack, principles, and status sections"
```

---

## Task 3 — Boot sequence label cleanup

**Files:**
- Modify: `components/sections/Hero.tsx:23` (the `MOBILE_LINE_SPECS` array)

### Problem

`MOBILE_LINE_SPECS[0]` is `'[BOOT SEQUENCE — MOBILE]'`. The "— MOBILE" suffix is an implementation detail leaking into UX. The em dash (`—`) is banned in outbound text (CLAUDE.md). Desktop says `[SYSTEM BOOT SEQUENCE INITIATED]` — mobile should feel like the same system, just abbreviated.

- [ ] **Step 1: Fix the MOBILE_LINE_SPECS first line**

In `Hero.tsx` line 23, change:

```tsx
// BEFORE
const MOBILE_LINE_SPECS: LinePart[][] = [
  ['[BOOT SEQUENCE — MOBILE]'],
```

To:

```tsx
// AFTER
const MOBILE_LINE_SPECS: LinePart[][] = [
  ['[BOOT SEQUENCE INITIATED]'],
```

- [ ] **Step 2: Verify in Playwright**

Reload at 390px. Wait for boot animation. First line should read `[BOOT SEQUENCE INITIATED]`.

- [ ] **Step 3: Commit**

```bash
git add components/sections/Hero.tsx
git commit -m "fix(hero): remove MOBILE suffix from boot sequence label, drop em dash"
```

---

## Task 4 — ManPage OPTIONS mobile layout

**Files:**
- Modify: `components/sections/ManPageSection.tsx`
- Modify: `app/css/_sections.css` (after `.manpage .m-dim {}` block, ~line 22)

### Problem

`@media (max-width: 768px) { .manpage pre { white-space: pre-wrap; word-break: break-word; } }` causes OPTIONS entries like `--domain       Strongest in regulated frontends (payments,\n                      healthcare, AI tooling)` to wrap with 22 leading spaces on the continuation line — creating bizarre indentation on narrow screens.

**Pattern to follow:** Same as ReadmeSection (`readme--desktop`/`readme--mobile` divs) and GitLogSection (`career-desktop`/`career-mobile` divs).

- [ ] **Step 1: Add manpage-mobile toggle CSS to _sections.css**

After the existing `@media (max-width: 768px)` block for `.manpage pre` (currently lines 24-26), add:

```css
.manpage--desktop { display: block; }
.manpage--mobile  { display: none; }

@media (max-width: 768px) {
  .manpage--desktop { display: none; }
  .manpage--mobile  { display: block; }
}

.manpage--mobile {
  font-family: var(--font-mono-stack);
  font-size: 12px;
  line-height: 1.7;
  color: var(--fg);
}
.manpage--mobile .mp-head {
  color: var(--signal);
  font-weight: 700;
  letter-spacing: 0.04em;
  font-size: 10px;
  margin-bottom: 12px;
  display: block;
  word-break: break-all;
}
.manpage--mobile .mp-sec {
  color: var(--signal);
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-top: 14px;
  margin-bottom: 4px;
  display: block;
}
.manpage--mobile .mp-name {
  color: var(--signal);
  font-weight: 700;
}
.manpage--mobile .mp-body {
  color: var(--fg);
  white-space: pre-wrap;
  word-break: break-word;
  display: block;
  padding-left: 2px;
}
.manpage--mobile .mp-opts {
  display: grid;
  grid-template-columns: 112px 1fr;
  gap: 0 8px;
  margin-top: 4px;
}
.manpage--mobile .mp-flag {
  color: var(--muted);
  opacity: 0.8;
  font-size: 11.5px;
  padding: 1px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.manpage--mobile .mp-desc {
  color: var(--fg);
  font-size: 11.5px;
  padding: 1px 0;
  line-height: 1.55;
}
.manpage--mobile .mp-examples {
  margin-top: 4px;
  display: block;
}
.manpage--mobile .mp-ex-line {
  display: block;
  color: var(--fg);
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
  margin-bottom: 2px;
}
.manpage--mobile .mp-ex-line .mp-mute { color: var(--muted); }
.manpage--mobile .mp-ex-line .mp-name { color: var(--signal); font-weight: 700; }
.manpage--mobile .mp-bugs {
  margin-top: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--fg);
  display: block;
}
```

- [ ] **Step 2: Wrap existing ManPageSection content in manpage--desktop + add manpage--mobile**

In `ManPageSection.tsx`, replace the entire component body:

```tsx
// BEFORE
export function ManPageSection() {
  return (
    <Module id="sec-man-page" header="MAN ERIK(1)" icon={<IconManPage />} defaultOpen={false}>
      <div className="manpage">
        <pre>
          ...entire pre content...
        </pre>
      </div>
    </Module>
  );
}
```

Replace with:

```tsx
export function ManPageSection() {
  return (
    <Module id="sec-man-page" header="MAN ERIK(1)" icon={<IconManPage />} defaultOpen={false}>
      {/* Desktop: full pre with fixed-width columns */}
      <div className="manpage manpage--desktop">
        <pre>
          <span className="m-head">{`${manPage.name.toUpperCase()}(1)                    User Commands                    ${manPage.name.toUpperCase()}(1)`}</span>
          {'\n\n\n'}
          <span className="m-sec">{'NAME'}</span>
          {'\n       '}
          <span className="m-erik">{manPage.name}</span>
          {` — ${manPage.tagline}\n\n`}
          <span className="m-sec">{'SYNOPSIS'}</span>
          {'\n       '}
          <span className="m-erik">{manPage.name}</span>
          {' ['}
          <span className="m-dim">{'--seniority'}</span>
          {' SENIOR|STAFF|PRINCIPAL]\n            ['}
          <span className="m-dim">{'--track'}</span>
          {' IC|LEAD]\n            ['}
          <span className="m-dim">{'--domain'}</span>
          {' PAYMENTS|HEALTHCARE|AI-TOOLING|E-COMMERCE]\n            ['}
          <span className="m-dim">{'--region'}</span>
          {' WORLDWIDE] ['}
          <span className="m-dim">{'--relocation'}</span>
          {']\n            ['}
          <span className="m-dim">{'--contract'}</span>
          {'|'}
          <span className="m-dim">{'--ft'}</span>
          {']\n            [<target-stack> ...]\n\n'}
          <span className="m-sec">{'DESCRIPTION'}</span>
          {`\n       Senior frontend engineer, 8+ years. Started full-stack,
       evolved into frontend architecture. Shipped production
       systems across payments (PCI-DSS), healthcare, banking,
       e-commerce, and ed-tech — Angular, React/Next.js, and
       Stencil micro-frontends powering €1B+ in revenue.
       Ranges across web, mobile (Ionic), and desktop (Electron).
       Recently built a 12-agent AI engineering platform in
       production. Currently embedded at Betsson (Malta, EU).\n\n`}
          <span className="m-sec">{'OPTIONS'}</span>
          {'\n       '}
          <span className="m-dim">{'--seniority'}</span>
          {'    Senior → Staff/Principal\n       '}
          <span className="m-dim">{'--track'}</span>
          {'        Individual contributor or technical lead\n       '}
          <span className="m-dim">{'--domain'}</span>
          {'       Strongest in regulated frontends (payments,\n                      healthcare, AI tooling); open to adjacent\n       '}
          <span className="m-dim">{'--region'}</span>
          {'       Worldwide; remote-first\n       '}
          <span className="m-dim">{'--relocation'}</span>
          {'   Open to relocating for the right role\n       '}
          <span className="m-dim">{'--regulated'}</span>
          {'    Specialty: PCI-DSS, healthcare, banking\n       '}
          <span className="m-dim">{'--contract'}</span>
          {'     Open to fixed-term or freelance\n       '}
          <span className="m-dim">{'--ft'}</span>
          {'           Open to full-time\n       '}
          <span className="m-dim">{'--hire'}</span>
          {'         Initiates handshake. See '}
          <span className="m-sec">{'CONTACT'}</span>
          {'.\n\n'}
          <span className="m-sec">{'EXAMPLES'}</span>
          {'\n       '}
          <span className="m-mute">{'$'}</span>
          {' '}
          <span className="m-erik">{manPage.name}</span>
          {' --seniority STAFF --domain PAYMENTS --ft\n       '}
          <span className="m-mute">{'$'}</span>
          {' '}
          <span className="m-erik">{manPage.name}</span>
          {' --track LEAD --domain AI-TOOLING --ft\n       '}
          <span className="m-mute">{'$'}</span>
          {' '}
          <span className="m-erik">{manPage.name}</span>
          {' --seniority PRINCIPAL --region WORLDWIDE --relocation\n       '}
          <span className="m-mute">{'$'}</span>
          {' '}
          <span className="m-erik">{manPage.name}</span>
          {' --contract --stack "TypeScript, micro-frontends, AI"\n\n'}
          <span className="m-sec">{'KNOWN BUGS'}</span>
          {`\n       - Occasionally rewrites a working component for clarity.
       - Will not stop talking about bundle size.
       - Sometimes ships the test before the feature.\n\n`}
          <span className="m-sec">{'AUTHOR'}</span>
          {'\n       Written by Erik Henrique Alves Cunha.\n       Report bugs to: '}
          <span className="m-erik">{'erikhenriquealvescunha@gmail.com'}</span>
          {'\n\n'}
          <span className="m-sec">{'SEE ALSO'}</span>
          {'\n       cv(1), github(1), linkedin(1), calendar(1)\n\n\n'}
          <span className="m-head">{`${manPage.version}                       ${manPage.date}                       ${manPage.name.toUpperCase()}(1)`}</span>
        </pre>
      </div>

      {/* Mobile: semantic layout — no pre-wrap column fighting */}
      <div className="manpage--mobile">
        <span className="mp-head">{`${manPage.name.toUpperCase()}(1) — User Commands`}</span>

        <span className="mp-sec">NAME</span>
        <span className="mp-body">
          <span className="mp-name">{manPage.name}</span>
          {` — ${manPage.tagline}`}
        </span>

        <span className="mp-sec">DESCRIPTION</span>
        <span className="mp-body">{`Senior frontend engineer, 8+ years. Shipped production systems across payments (PCI-DSS), healthcare, e-commerce, and ed-tech. Angular, React/Next.js, Stencil micro-frontends powering €1B+ in revenue. 12-agent AI platform in production. Currently at Betsson (Malta, EU).`}</span>

        <span className="mp-sec">OPTIONS</span>
        <div className="mp-opts">
          <span className="mp-flag">--seniority</span>
          <span className="mp-desc">Senior → Staff/Principal</span>
          <span className="mp-flag">--track</span>
          <span className="mp-desc">IC or technical lead</span>
          <span className="mp-flag">--domain</span>
          <span className="mp-desc">Payments, healthcare, AI tooling</span>
          <span className="mp-flag">--region</span>
          <span className="mp-desc">Worldwide; remote-first</span>
          <span className="mp-flag">--relocation</span>
          <span className="mp-desc">Open to relocating</span>
          <span className="mp-flag">--regulated</span>
          <span className="mp-desc">PCI-DSS, healthcare, banking</span>
          <span className="mp-flag">--contract</span>
          <span className="mp-desc">Fixed-term or freelance</span>
          <span className="mp-flag">--ft</span>
          <span className="mp-desc">Full-time</span>
          <span className="mp-flag">--hire</span>
          <span className="mp-desc">Initiates handshake. See CONTACT.</span>
        </div>

        <span className="mp-sec">EXAMPLES</span>
        <span className="mp-examples">
          <span className="mp-ex-line"><span className="mp-mute">$</span> <span className="mp-name">{manPage.name}</span>{' --seniority STAFF --domain PAYMENTS --ft'}</span>
          <span className="mp-ex-line"><span className="mp-mute">$</span> <span className="mp-name">{manPage.name}</span>{' --track LEAD --domain AI-TOOLING --ft'}</span>
          <span className="mp-ex-line"><span className="mp-mute">$</span> <span className="mp-name">{manPage.name}</span>{' --seniority PRINCIPAL --region WORLDWIDE --relocation'}</span>
        </span>

        <span className="mp-sec">KNOWN BUGS</span>
        <span className="mp-bugs">{`- Occasionally rewrites a working component for clarity.\n- Will not stop talking about bundle size.\n- Sometimes ships the test before the feature.`}</span>

        <span className="mp-sec">AUTHOR</span>
        <span className="mp-body">Written by Erik Henrique Alves Cunha.</span>
      </div>
    </Module>
  );
}
```

- [ ] **Step 3: Remove the old pre-wrap override from _sections.css**

The `@media (max-width: 768px)` rule for `.manpage pre` is now only for the desktop pre that's hidden on mobile — but we might as well keep it for cases where someone forces desktop view. Leave it in place; it won't affect `.manpage--mobile`.

- [ ] **Step 4: Verify in Playwright**

At 390px, open MAN ERIK(1). Confirm OPTIONS renders as a clean two-column grid with no wrapping issues. Check that flags align and descriptions are readable.

- [ ] **Step 5: Commit**

```bash
git add components/sections/ManPageSection.tsx app/css/_sections.css
git commit -m "fix(man-page): add mobile semantic layout to replace pre-wrap column fighting"
```

---

## Task 5 — git blame ToTopButton right-edge overlap

**Files:**
- Modify: `app/css/_sections.css` (inside `@media (max-width: 768px)` or add new block)

### Problem

`.blame` has no right padding. `.blame-body` text reaches the full content width. The `ToTopButton` is `position: fixed; right: 14px; width: 40px` — meaning it occupies the rightmost 54px of the viewport. When the blame section is visible and the button is shown, the last ~40px of each blame-body line is obscured.

- [ ] **Step 1: Add right padding to .blame on mobile**

In `_sections.css`, find the `@media (max-width: 560px)` block that modifies `.blame-row`. Add:

```css
@media (max-width: 768px) {
  .blame { padding-right: 56px; }
}
```

(56px = 40px button width + 14px right offset + 2px clearance)

- [ ] **Step 2: Also reduce blame-body font-size on mobile**

Still in the same `@media (max-width: 768px)` block:

```css
@media (max-width: 768px) {
  .blame { padding-right: 56px; }
  .blame-body { font-size: 12.5px; }
}
```

This gives slightly more characters per line while keeping the content readable.

- [ ] **Step 3: Verify in Playwright**

Scroll to GIT BLAME --CAREER at 390px. Check that company/role names are fully visible without ToTopButton overlap.

- [ ] **Step 4: Commit**

```bash
git add app/css/_sections.css
git commit -m "fix(git-blame): add right padding to prevent ToTopButton overlap on mobile"
```

---

## Task 6 — Footer bottom clearance

**Files:**
- Modify: `app/css/_footer.css`

### Problem

`footer.shutdown` has `padding: 40px var(--pad) 24px` on mobile. The dock is `position: fixed; bottom: 0` with height ≈ 64px + safe-area. Body has `padding-bottom: calc(80px + safe-area)`. The 24px footer bottom padding means the `shutdown-copy` copyright line sits only 24px from the body's content end — on some devices this can be tight. More critically, the footer itself needs `padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px))` rather than a flat 24px to ensure content stays above the dock cutout.

- [ ] **Step 1: Update footer mobile padding to respect safe-area**

In `_footer.css`, find the `@media (max-width: 900px)` block (line ~210):

```css
/* BEFORE */
@media (max-width: 900px) {
  footer.shutdown { padding: 40px var(--pad) 24px; }
  ...
}
```

Change to:

```css
/* AFTER */
@media (max-width: 900px) {
  footer.shutdown { padding: 40px var(--pad) calc(24px + env(safe-area-inset-bottom, 0px)); }
  ...
}
```

- [ ] **Step 2: Verify in Playwright**

Scroll to very bottom at 390px. The `shutdown-copy` text and the [SYSTEM HALTED] element should be fully visible above the dock, not clipped.

- [ ] **Step 3: Commit**

```bash
git add app/css/_footer.css
git commit -m "fix(footer): respect safe-area-inset-bottom in mobile footer padding"
```

---

## Final verification

- [ ] Start dev server: `pnpm dev`
- [ ] Playwright at 390×844: navigate to `localhost:3000`
- [ ] Take full-page screenshot and compare section by section against phone screenshots
- [ ] Confirm all 6 issues are resolved:
  - [ ] NETSTAT State/Endpoint columns align
  - [ ] README mobile has Core Stack, Principles, Status sections
  - [ ] Boot sequence reads `[BOOT SEQUENCE INITIATED]`
  - [ ] ManPage OPTIONS renders as clean two-column grid
  - [ ] git blame text not cut by ToTopButton
  - [ ] Footer copyright visible above dock

## Self-review

**Spec coverage:**
- Issue 1 (NETSTAT): Task 1 ✓
- Issue 2 (README sparse): Task 2 ✓
- Issue 3 (boot label): Task 3 ✓
- Issue 4 (manpage wrap): Task 4 ✓
- Issue 5 (blame overlap): Task 5 ✓
- Issue 6 (footer bottom): Task 6 ✓

**Placeholder scan:** All steps have concrete code. No TBD/TODO. No "similar to Task N" shortcuts.

**Type consistency:** No new types introduced. Existing `ReadmeLine` type is unchanged — the new array elements match its shape (`{ text: string; cls?: string }` or `{ node: ReactNode }`).
