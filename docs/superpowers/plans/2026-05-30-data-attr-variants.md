# Data-Attribute Variant Pattern Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all 7 className ternary/template-literal concatenation patterns (visual variants only) with `data-*` attribute + CSS attribute selectors, moving visual branching entirely out of TSX.

**Architecture:** Each migrated element keeps one stable CSS Module class; a `data-*` attribute set from the same prop drives visual variation via `[data-attr]` or `[data-attr="value"]` CSS selectors. TypeScript types on all props are unchanged. The approach eliminates template-literal string concatenation from JSX for the targeted visual patterns. Functional/semantic states (scroll visibility, audio toggle, animation, navigation) are explicitly excluded and stay as className conditionals.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, CSS Modules (no utility classes), Biome, Vitest

---

## Inversion failure modes → guards built into this plan

| Failure | Guard |
|---|---|
| Incomplete scan — mixed patterns after merge | Tasks 1–7 cover all 7 identified targets; nothing is left partial |
| Test regression — class-name queries break | Every task audits and updates the component test file |
| CSS specificity surprise | Each task states before/after specificity; `::before` pseudo-elements must follow the parent selector change |
| Type drift — typo in `data-attr="vlaue"` not caught by TS | Attribute values are string literals in JSX (TS checks prop type); CSS selectors are co-located, reviewed in same commit |
| Over-migration — ARIA/functional states | Excluded explicitly; scope is visual-only; see Architecture above |

---

## Files Modified

| File | Tasks |
|---|---|
| `components/responsive/Module/Module.tsx` | 1, 2 |
| `components/responsive/Module/Module.module.css` | 1, 2 |
| `components/responsive/Module/Module.test.tsx` | 1, 2 (audit) |
| `components/sections/PerfReceiptsSection/PerfReceiptsSection.tsx` | 3 |
| `components/sections/PerfReceiptsSection/PerfReceiptsSection.module.css` | 3 |
| `components/sections/PerfReceiptsSection/PerfReceiptsSection.test.tsx` | 3 (audit) |
| `components/sections/ResponsibilitiesSection/ResponsibilitiesSection.tsx` | 4 |
| `components/sections/ResponsibilitiesSection/ResponsibilitiesSection.module.css` | 4 |
| `components/sections/ResponsibilitiesSection/ResponsibilitiesSection.test.tsx` | 4 (audit) |
| `components/sections/DawMixerSection/DawMixerDesktop.tsx` | 5, 6 |
| `components/sections/DawMixerSection/DawMixerSection.tsx` | 5, 6 |
| `components/sections/DawMixerSection/DawMixerSection.module.css` | 5, 6 |
| `components/sections/DawMixerSection/DawMixerSection.test.tsx` | 5, 6 (audit) |
| `components/sections/GuitarSection/GuitarSection.tsx` | 7 |
| `components/sections/GuitarSection/GuitarSection.module.css` | 7 |
| `components/sections/GuitarSection/GuitarSection.test.tsx` | 7 (audit) |

---

## Task 1 — Module: `variant` prop → `data-variant`

**Context:** PR #72 already merged a class-concatenation approach for the `variant` prop. This task replaces it with the data-attribute pattern on the same branch (or a new `refactor/data-attr-variants` branch off main once #72 is merged).

**Files:**
- Modify: `components/responsive/Module/Module.tsx:68–82`
- Modify: `components/responsive/Module/Module.module.css` (`.bodyContentGreen` class)
- Audit: `components/responsive/Module/Module.test.tsx`

- [ ] **Step 1: Audit Module tests for class-name queries**

  Run:
  ```bash
  grep -n "bodyContentGreen\|bodyContent\|className" components/responsive/Module/Module.test.tsx
  ```
  Expected: no assertions on `bodyContentGreen` or `bodyContent` class strings. If any exist, update them in this step to assert on `[data-variant="green"]` attribute presence instead.

- [ ] **Step 2: Write a failing test for `data-variant` attribute**

  In `components/responsive/Module/Module.test.tsx`, add:
  ```tsx
  it('passes data-variant="green" attribute to bodyContent when variant="green"', async () => {
    const { container } = render(<Module id="test" header="TEST" variant="green">content</Module>);
    // The details element must be open for bodyContent to be accessible
    const bodyContent = container.querySelector('[data-variant="green"]');
    expect(bodyContent).not.toBeNull();
  });

  it('renders no data-variant attribute when variant is not set', async () => {
    const { container } = render(<Module id="test" header="TEST">content</Module>);
    const bodyContent = container.querySelector('[data-variant]');
    expect(bodyContent).toBeNull();
  });
  ```

  Run: `pnpm test --run Module.test` — expect **FAIL** (current impl uses CSS class, not data-attr).

- [ ] **Step 3: Update `Module.tsx` — replace class concat with `data-variant`**

  In `Module.tsx`, find the bodyContent div (currently ~line 68–82) and replace:
  ```tsx
  <div
    className={
      variant === 'green'
        ? `${styles.bodyContent} ${styles.bodyContentGreen}`
        : styles.bodyContent
    }
  >
  ```
  With:
  ```tsx
  <div className={styles.bodyContent} data-variant={variant}>
  ```

- [ ] **Step 4: Update `Module.module.css` — replace `.bodyContentGreen` with attribute selector**

  Find and replace the `.bodyContentGreen` class:
  ```css
  /* Remove this: */
  .bodyContentGreen {
    background: rgba(0, 255, 65, 0.05);
  }

  /* Add this (after .bodyContent block): */
  .bodyContent[data-variant="green"] {
    background: rgba(0, 255, 65, 0.05);
  }
  ```

  Specificity: `.bodyContent[data-variant="green"]` = 0,2,0 (one class + one attribute). Same as the old two-class approach conceptually. The desktop compound selector `.root[open] .bodyContent` (0,3,0) still wins and adds the border — no change needed there.

- [ ] **Step 5: Run tests**

  ```bash
  pnpm test --run Module.test
  ```
  Expected: all Module tests pass including the two new ones.

- [ ] **Step 6: Run typecheck**

  ```bash
  pnpm typecheck
  ```
  Expected: no errors (variant prop type is unchanged).

- [ ] **Step 7: Commit**

  ```bash
  git add -u components/responsive/Module/
  git commit -m "refactor(module): variant prop — class concat → data-variant attribute"
  ```

---

## Task 2 — Module: `defer` class → `details[data-cv-defer]` CSS

**Context:** The `defer` prop already conditionally adds `data-cv-defer="true"` to the `<details>` element (via a spread in Module.tsx). The `.cvDefer` CSS class is redundant — moving its rules under `details[data-cv-defer="true"]` eliminates the last className conditional in Module.

**Files:**
- Modify: `components/responsive/Module/Module.tsx:55`
- Modify: `components/responsive/Module/Module.module.css` (`.cvDefer` class)

- [ ] **Step 1: Verify `data-cv-defer` attribute is already present on the element**

  In `Module.tsx`, confirm this spread exists on the `<details>` element:
  ```tsx
  {...(defer ? { 'data-cv-defer': 'true' } : {})}
  ```
  If present, no TSX change is needed beyond removing the className conditional in the next step.

- [ ] **Step 2: Write a failing test**

  In `Module.test.tsx`, add:
  ```tsx
  it('adds data-cv-defer attribute when defer=true, no cvDefer class', async () => {
    const { container } = render(<Module id="test" header="TEST" defer>content</Module>);
    const details = container.querySelector('details');
    expect(details?.getAttribute('data-cv-defer')).toBe('true');
    // Must NOT have a class containing 'cvDefer' — CSS is handled by attribute selector
    expect(details?.className).not.toContain('cvDefer');
  });
  ```

  Run: `pnpm test --run Module.test` — expect **FAIL** (current impl adds `.cvDefer` class).

- [ ] **Step 3: Update `Module.tsx` — remove `.cvDefer` from className**

  Find the `<details>` opening tag in `Module.tsx` (currently ~line 43–47):
  ```tsx
  <details
    id={id}
    className={defer ? `${styles.root} ${styles.cvDefer}` : styles.root}
    open
    {...(defer ? { 'data-cv-defer': 'true' } : {})}
  >
  ```
  Replace with:
  ```tsx
  <details
    id={id}
    className={styles.root}
    open
    {...(defer ? { 'data-cv-defer': 'true' } : {})}
  >
  ```

- [ ] **Step 4: Update `Module.module.css` — move `.cvDefer` rule to `details[data-cv-defer]`**

  Find the `.cvDefer` block:
  ```css
  .cvDefer {
    content-visibility: auto;
    contain-intrinsic-size: auto 520px;
  }
  ```
  Replace with:
  ```css
  details[data-cv-defer="true"] {
    content-visibility: auto;
    contain-intrinsic-size: auto 520px;
  }
  ```

  **Specificity note:** `.cvDefer` = 0,1,0. `details[data-cv-defer="true"]` = 0,1,1 (element + attribute). Slightly higher. Run the test in the next step to confirm no regression.

- [ ] **Step 5: Run tests and typecheck**

  ```bash
  pnpm test --run Module.test && pnpm typecheck
  ```
  Expected: all pass.

- [ ] **Step 6: Commit**

  ```bash
  git add -u components/responsive/Module/
  git commit -m "refactor(module): defer — cvDefer class → details[data-cv-defer] CSS selector"
  ```

---

## Task 3 — PerfReceiptsSection: `hero` prop → `data-featured`

**Context:** `hero` is a boolean prop on `DeltaValue` (or inline in `PerfReceiptsSection.tsx`) that enlarges the delta number for the featured receipt card. The `.deltaHero` class is purely presentational.

**Files:**
- Modify: `components/sections/PerfReceiptsSection/PerfReceiptsSection.tsx:36`
- Modify: `components/sections/PerfReceiptsSection/PerfReceiptsSection.module.css`
- Audit: `components/sections/PerfReceiptsSection/PerfReceiptsSection.test.tsx`

- [ ] **Step 1: Audit tests for class-name queries**

  ```bash
  grep -n "deltaHero\|hero\|className" components/sections/PerfReceiptsSection/PerfReceiptsSection.test.tsx
  ```
  If any assertion uses `[class*="deltaHero"]` or checks `.className`, update it to assert on `[data-featured]` attribute presence instead.

- [ ] **Step 2: Write failing test**

  In `PerfReceiptsSection.test.tsx`, add or replace an existing hero-card test:
  ```tsx
  it('adds data-featured attribute to hero delta', async () => {
    const doc = await renderToStaticMarkup(<PerfReceiptsSection />);
    const parser = new DOMParser();
    const dom = parser.parseFromString(doc, 'text/html');
    // The first receipt in perf-receipts content has hero: true
    const heroDelta = dom.querySelector('.delta[data-featured]') ??
      dom.querySelector('[data-featured]');
    expect(heroDelta).not.toBeNull();
  });
  ```
  *(Adjust selector to match how PerfReceiptsSection renders in tests — check existing test setup.)*

  Run: `pnpm test --run PerfReceiptsSection.test` — expect **FAIL**.

- [ ] **Step 3: Update `PerfReceiptsSection.tsx` — replace class concat**

  Find the line (~36):
  ```tsx
  className={hero ? `${styles.delta} ${styles.deltaHero}` : styles.delta}
  ```
  Replace with:
  ```tsx
  className={styles.delta}
  data-featured={hero || undefined}
  ```

  `hero || undefined` ensures the attribute is omitted entirely (not set to `"false"`) when `hero` is falsy.

- [ ] **Step 4: Update `PerfReceiptsSection.module.css` — replace `.deltaHero` with attribute selector**

  Find all occurrences of `.deltaHero` and replace:

  ```css
  /* Remove: */
  .deltaHero {
    font-size: var(--ds-font-size-heading-xl);
  }
  @media (max-width: 900px) {
    .deltaHero {
      font-size: var(--ds-font-size-heading-xl);
    }
  }
  .receiptHero .deltaHero {
    font-size: var(--ds-font-size-heading-xl);
  }
  @media (max-width: 768px) {
    /* Higher specificity (0,2,0) beats .delta (0,1,0) */
    .receiptHero .deltaHero {
      font-size: var(--ds-font-size-heading-md);
    }
  }

  /* Add (replace each occurrence in-place): */
  .delta[data-featured] {
    font-size: var(--ds-font-size-heading-xl);
  }
  @media (max-width: 900px) {
    .delta[data-featured] {
      font-size: var(--ds-font-size-heading-xl);
    }
  }
  .receiptHero .delta[data-featured] {
    font-size: var(--ds-font-size-heading-xl);
  }
  @media (max-width: 768px) {
    /* Specificity: .receiptHero .delta[data-featured] = 0,3,0 beats .delta[data-featured] = 0,2,0 ✓ */
    .receiptHero .delta[data-featured] {
      font-size: var(--ds-font-size-heading-md);
    }
  }
  ```

  Verify with `grep -n "deltaHero" PerfReceiptsSection.module.css` — result must be empty.

- [ ] **Step 5: Run tests and typecheck**

  ```bash
  pnpm test --run PerfReceiptsSection.test && pnpm typecheck
  ```
  Expected: all pass.

- [ ] **Step 6: Commit**

  ```bash
  git add -u components/sections/PerfReceiptsSection/
  git commit -m "refactor(perf-receipts): hero — class concat → data-featured attribute"
  ```

---

## Task 4 — ResponsibilitiesSection: `r.highlight` → `data-highlight`

**Context:** `r.highlight` is a boolean from the content schema that marks critical responsibility lines with signal green. The `.crit` class is purely presentational.

**Files:**
- Modify: `components/sections/ResponsibilitiesSection/ResponsibilitiesSection.tsx:31`
- Modify: `components/sections/ResponsibilitiesSection/ResponsibilitiesSection.module.css`
- Audit: `components/sections/ResponsibilitiesSection/ResponsibilitiesSection.test.tsx`

- [ ] **Step 1: Audit tests**

  ```bash
  grep -n "crit\|highlight\|className" components/sections/ResponsibilitiesSection/ResponsibilitiesSection.test.tsx
  ```
  Update any class-name assertions to use `[data-highlight]` attribute selectors.

- [ ] **Step 2: Write failing test**

  In `ResponsibilitiesSection.test.tsx`:
  ```tsx
  it('adds data-highlight to highlighted responsibility lines', async () => {
    // Assumes at least one entry in content/responsibilities.ts has highlight: true
    const doc = await renderToStaticMarkup(<ResponsibilitiesSection />);
    const parser = new DOMParser();
    const dom = parser.parseFromString(doc, 'text/html');
    const highlighted = dom.querySelector('[data-highlight]');
    expect(highlighted).not.toBeNull();
  });
  ```

  Run: `pnpm test --run ResponsibilitiesSection.test` — expect **FAIL**.

- [ ] **Step 3: Update `ResponsibilitiesSection.tsx`**

  Find (~line 31):
  ```tsx
  className={`${styles.file}${r.highlight ? ` ${styles.crit}` : ''}`}
  ```
  Replace with:
  ```tsx
  className={styles.file}
  data-highlight={r.highlight || undefined}
  ```

- [ ] **Step 4: Update `ResponsibilitiesSection.module.css`**

  Find:
  ```css
  .root .file.crit {
    color: var(--ds-color-signal);
    font-weight: 700;
  }
  ```
  Replace with:
  ```css
  .root .file[data-highlight] {
    color: var(--ds-color-signal);
    font-weight: 700;
  }
  ```

  Specificity: `.root .file[data-highlight]` = 0,3,0 — identical to `.root .file.crit` ✓.

  Verify no remaining `.crit` references: `grep -n "crit" ResponsibilitiesSection.module.css` — must be empty.

- [ ] **Step 5: Run tests and typecheck**

  ```bash
  pnpm test --run ResponsibilitiesSection.test && pnpm typecheck
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add -u components/sections/ResponsibilitiesSection/
  git commit -m "refactor(responsibilities): highlight — class concat → data-highlight attribute"
  ```

---

## Task 5 — DawMixer: channel row `focused` + `isMaster` → `data-focused` + `data-channel`

**Context:** `DawMixerDesktop.tsx` and `DawMixerSection.tsx` both render channel rows with multi-class ternaries for `ch.focused` and `isMaster`. Both import CSS from `DawMixerSection.module.css` as `s`. This task migrates the channel row container classes; the badge classes are handled separately in Task 6.

**Files:**
- Modify: `components/sections/DawMixerSection/DawMixerDesktop.tsx:53`
- Modify: `components/sections/DawMixerSection/DawMixerSection.tsx:157`
- Modify: `components/sections/DawMixerSection/DawMixerSection.module.css`
- Audit: `components/sections/DawMixerSection/DawMixerSection.test.tsx`

- [ ] **Step 1: Audit tests — `channelFocused` class query**

  ```bash
  grep -n "channelFocused\|channelMaster\|channelCardFocused\|channelCardMaster\|className" \
    components/sections/DawMixerSection/DawMixerSection.test.tsx
  ```

  Expected: line 60 contains `expect(ch02?.className).toContain('channelFocused')`.

  Update that assertion:
  ```tsx
  // Before:
  expect(ch02?.className).toContain('channelFocused');
  // After:
  expect(ch02?.hasAttribute('data-focused')).toBe(true);
  ```

- [ ] **Step 2: Write failing test for `data-channel="master"` on MASTER row**

  In `DawMixerSection.test.tsx`:
  ```tsx
  it('MASTER channel row has data-channel="master"', async () => {
    const { container } = render(<DawMixerDesktop />);
    const masterRow = container.querySelector('[data-testid="channel-MASTER"]');
    expect(masterRow?.getAttribute('data-channel')).toBe('master');
  });
  ```

  Run: `pnpm test --run DawMixerSection.test` — expect **FAIL** on updated assertion.

- [ ] **Step 3: Update `DawMixerDesktop.tsx` — channel row (~line 53)**

  Replace:
  ```tsx
  className={`${s.channelRow} ${ch.focused ? s.channelFocused : ''} ${isMaster ? s.channelMaster : ''}`}
  ```
  With:
  ```tsx
  className={s.channelRow}
  data-focused={ch.focused || undefined}
  data-channel={isMaster ? 'master' : undefined}
  ```

- [ ] **Step 4: Update `DawMixerSection.tsx` — channel card (~line 157)**

  Replace:
  ```tsx
  className={`${s.channelCard} ${ch.focused ? s.channelCardFocused : ''} ${isMaster ? s.channelCardMaster : ''}`}
  ```
  With:
  ```tsx
  className={s.channelCard}
  data-focused={ch.focused || undefined}
  data-channel={isMaster ? 'master' : undefined}
  ```

- [ ] **Step 5: Update `DawMixerSection.module.css` — desktop channel row classes**

  Replace each class with an attribute selector on `.channelRow`:

  ```css
  /* Remove: */
  .channelFocused {
    background: color-mix(in srgb, var(--ds-color-signal) 6%, transparent);
  }
  .channelFocused::before {
    content: "";
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--ds-color-signal);
    box-shadow: 0 0 10px var(--ds-color-signal);
  }
  .channelMaster {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--ds-color-signal) 8%, transparent),
      color-mix(in srgb, var(--ds-color-signal) 2%, transparent)
    );
    border-top: 1px solid var(--ds-color-signal);
  }

  /* Add (after .channelRow blocks): */
  .channelRow[data-focused] {
    background: color-mix(in srgb, var(--ds-color-signal) 6%, transparent);
  }
  .channelRow[data-focused]::before {
    content: "";
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--ds-color-signal);
    box-shadow: 0 0 10px var(--ds-color-signal);
  }
  .channelRow[data-channel="master"] {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--ds-color-signal) 8%, transparent),
      color-mix(in srgb, var(--ds-color-signal) 2%, transparent)
    );
    border-top: 1px solid var(--ds-color-signal);
  }
  ```

  Also update the compound selectors that reference `.channelFocused`:
  ```css
  /* Remove: */
  .channelFocused .clipBar { ... }
  .channelFocused .clipFill { ... }
  .channelFocused .trackName,
  .channelMaster .trackName { ... }

  /* Add: */
  .channelRow[data-focused] .clipBar {
    border-color: var(--ds-color-signal);
    box-shadow: 0 0 6px color-mix(in srgb, var(--ds-color-signal) 40%, transparent);
  }
  .channelRow[data-focused] .clipFill {
    opacity: 1;
  }
  .channelRow[data-focused] .trackName,
  .channelRow[data-channel="master"] .trackName {
    color: var(--ds-color-signal);
  }
  ```

  *(Read the exact values from the file before editing — exact values above are from the current codebase as of this plan.)*

- [ ] **Step 6: Update `DawMixerSection.module.css` — mobile channel card classes**

  Replace each class with an attribute selector on `.channelCard`:

  ```css
  /* Remove: */
  .channelCardFocused {
    background: color-mix(in srgb, var(--ds-color-signal) 7%, transparent);
  }
  .channelCardFocused::before {
    content: "";
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--ds-color-signal);
    box-shadow: 0 0 10px var(--ds-color-signal);
  }
  .channelCardMaster {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--ds-color-signal) 6%, transparent),
      transparent
    );
    border-top: 2px solid var(--ds-color-signal);
  }

  /* Add: */
  .channelCard[data-focused] {
    background: color-mix(in srgb, var(--ds-color-signal) 7%, transparent);
  }
  .channelCard[data-focused]::before {
    content: "";
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--ds-color-signal);
    box-shadow: 0 0 10px var(--ds-color-signal);
  }
  .channelCard[data-channel="master"] {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--ds-color-signal) 6%, transparent),
      transparent
    );
    border-top: 2px solid var(--ds-color-signal);
  }
  ```

  Also update compound selectors:
  ```css
  /* Remove: */
  .channelCardFocused .mxId { ... }
  .channelCardFocused .mxName,
  .channelCardMaster .mxName { ... }

  /* Add: */
  .channelCard[data-focused] .mxId {
    color: var(--ds-color-signal);
    border-color: var(--ds-color-signal);
    background: color-mix(in srgb, var(--ds-color-signal) 10%, transparent);
  }
  .channelCard[data-focused] .mxName,
  .channelCard[data-channel="master"] .mxName {
    color: var(--ds-color-signal);
  }
  ```

  Verify: `grep -n "channelFocused\|channelCardFocused\|channelMaster\|channelCardMaster" DawMixerSection.module.css` — must be empty.

- [ ] **Step 7: Run tests and typecheck**

  ```bash
  pnpm test --run DawMixerSection.test && pnpm typecheck
  ```

- [ ] **Step 8: Commit**

  ```bash
  git add -u components/sections/DawMixerSection/
  git commit -m "refactor(daw-mixer): channel focused/master — class concat → data-focused/data-channel"
  ```

---

## Task 6 — DawMixer: badge `isMaster` → `data-channel`

**Context:** Both desktop (`.channelBadge` vs `.masterBadge`) and mobile (`.mxId` vs `.masterBadge`) use a full class swap for the MASTER badge. The pattern becomes: one base class always, master overrides via `[data-channel="master"]`.

**Files:**
- Modify: `components/sections/DawMixerSection/DawMixerDesktop.tsx:57`
- Modify: `components/sections/DawMixerSection/DawMixerSection.tsx:161`
- Modify: `components/sections/DawMixerSection/DawMixerSection.module.css`

*(No new test needed — Task 5 already covers `data-channel` on the channel row. The badge is a child element; its visual output is asserted via Playwright visual check in Task 8.)*

- [ ] **Step 1: Update `DawMixerDesktop.tsx` — badge (~line 57)**

  Replace:
  ```tsx
  className={isMaster ? s.masterBadge : s.channelBadge}
  ```
  With:
  ```tsx
  className={s.channelBadge}
  data-channel={isMaster ? 'master' : undefined}
  ```

- [ ] **Step 2: Update `DawMixerSection.tsx` — mobile badge (~line 161)**

  Replace:
  ```tsx
  className={isMaster ? s.masterBadge : s.mxId}
  ```
  With:
  ```tsx
  className={s.mxId}
  data-channel={isMaster ? 'master' : undefined}
  ```

- [ ] **Step 3: Update `DawMixerSection.module.css` — desktop badge**

  `.channelBadge` is the base. `.masterBadge` differences (from the current CSS):
  - `border: 1px solid var(--ds-color-signal)` (vs `var(--ds-color-border-default)`)
  - `padding: 2px 8px` (vs `1px 5px`)
  - `font-weight: 700` (vs none)
  - `color: var(--ds-color-signal)` (vs `var(--ds-color-text-muted)`)
  - `letter-spacing: 0.12em` (vs `0.04em`)

  ```css
  /* Remove: */
  .masterBadge {
    border: 1px solid var(--ds-color-signal);
    padding: 2px 8px;
    font-size: var(--ds-font-size-xs);
    font-family: var(--ds-font-family-mono);
    font-weight: 700;
    color: var(--ds-color-signal);
    letter-spacing: 0.12em;
    flex-shrink: 0;
  }

  /* Add (after .channelBadge block): */
  .channelBadge[data-channel="master"] {
    border-color: var(--ds-color-signal);
    padding: 2px 8px;
    font-weight: 700;
    color: var(--ds-color-signal);
    letter-spacing: 0.12em;
  }
  ```

  Note: `font-size`, `font-family`, `flex-shrink` inherit from `.channelBadge` — only override the differences.

- [ ] **Step 4: Update `DawMixerSection.module.css` — mobile badge**

  `.mxId` is the base. The master treatment on mobile needs the same visual as `.masterBadge`:

  ```css
  /* Add (after .mxId block): */
  .mxId[data-channel="master"] {
    border-color: var(--ds-color-signal);
    padding: 2px 8px;
    font-weight: 700;
    color: var(--ds-color-signal);
    letter-spacing: 0.12em;
    background: transparent;
  }
  ```

  Verify: `grep -n "masterBadge" DawMixerSection.module.css` — must be empty.

  Also check compound selectors in the shared/responsive rules section:
  ```bash
  grep -n "masterBadge\|\.root .channelBadge\|\.root .masterBadge" DawMixerSection.module.css
  ```
  If `.root .masterBadge` appears in a compound rule (e.g., shared font-size override), replace `.root .masterBadge` with `.root .channelBadge[data-channel="master"]` and `.root .mxId[data-channel="master"]`.

- [ ] **Step 5: Run tests and typecheck**

  ```bash
  pnpm test --run DawMixerSection.test && pnpm typecheck
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add -u components/sections/DawMixerSection/
  git commit -m "refactor(daw-mixer): badge isMaster — class swap → channelBadge[data-channel=master]"
  ```

---

## Task 7 — GuitarSection: `inf.active` → `data-active`

**Context:** `.infActive` and `.infItem` are structurally identical (same grid layout, gap, alignment) — they differ only in `color` and `font-weight`. Migrating means `.infItem` is always the class, `.infItem[data-active]` provides the signal-green highlight.

**Files:**
- Modify: `components/sections/GuitarSection/GuitarSection.tsx:82`
- Modify: `components/sections/GuitarSection/GuitarSection.module.css`
- Modify: `components/sections/GuitarSection/GuitarSection.test.tsx:63`

- [ ] **Step 1: Audit and update the test at line 63**

  Current (`GuitarSection.test.tsx:63`):
  ```tsx
  const active = doc.querySelector('[data-testid="guitar-desktop"] [class*="infActive"]');
  ```
  Replace with:
  ```tsx
  const active = doc.querySelector('[data-testid="guitar-desktop"] [data-active]');
  ```

  Run: `pnpm test --run GuitarSection.test` — expect **FAIL** (class still exists, attribute doesn't yet).

- [ ] **Step 2: Update `GuitarSection.tsx` (~line 82)**

  Replace:
  ```tsx
  className={inf.active ? s.infActive : s.infItem}
  ```
  With:
  ```tsx
  className={s.infItem}
  data-active={inf.active || undefined}
  ```

- [ ] **Step 3: Update `GuitarSection.module.css` — merge `.infActive` into `.infItem[data-active]`**

  Current state (both classes exist, lines ~206–224):
  ```css
  .infActive {
    display: grid;
    grid-template-columns: 36px 1fr auto;
    gap: 10px;
    align-items: center;
    margin-bottom: 9px;
    color: var(--ds-color-signal);
    font-weight: 700;
    font-size: var(--ds-font-size-xs);
  }
  .infItem {
    display: grid;
    grid-template-columns: 36px 1fr auto;
    gap: 10px;
    align-items: center;
    margin-bottom: 9px;
    color: var(--ds-color-text-body);
    font-size: var(--ds-font-size-xs);
  }
  ```

  Delete `.infActive` entirely. Add one modifier after `.infItem`:
  ```css
  .infItem {
    display: grid;
    grid-template-columns: 36px 1fr auto;
    gap: 10px;
    align-items: center;
    margin-bottom: 9px;
    color: var(--ds-color-text-body);
    font-size: var(--ds-font-size-xs);
  }
  .infItem[data-active] {
    color: var(--ds-color-signal);
    font-weight: 700;
  }
  ```

- [ ] **Step 4: Fix compound selector at line ~380**

  In `GuitarSection.module.css`, find the responsive font-size override:
  ```css
  .root .infActive,
  .root .infItem,
  ```
  Remove `.root .infActive,` — leave only `.root .infItem,`. The `[data-active]` modifier inherits the font-size from `.infItem` correctly via CSS cascade.

- [ ] **Step 5: Verify no stale `.infActive` references**

  ```bash
  grep -n "infActive" components/sections/GuitarSection/GuitarSection.module.css
  grep -n "infActive" components/sections/GuitarSection/GuitarSection.tsx
  grep -n "infActive" components/sections/GuitarSection/GuitarSection.test.tsx
  ```
  All three must return empty.

- [ ] **Step 6: Run tests and typecheck**

  ```bash
  pnpm test --run GuitarSection.test && pnpm typecheck
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add -u components/sections/GuitarSection/
  git commit -m "refactor(guitar): inf.active — class swap → infItem[data-active] attribute"
  ```

---

## Task 8 — Verification

- [ ] **Step 1: Full test suite**

  ```bash
  pnpm ci:local 2>&1 | tail -10
  ```
  Expected: all 655+ tests pass, lint clean, typecheck clean, content valid, naming gates green.

- [ ] **Step 2: Visual check — desktop + mobile**

  Start dev server: `pnpm dev`

  Use Playwright MCP to inspect:
  - Desktop (1280×720): scroll to each migrated section — check channel focused row has accent background, master badge is signal green, highlighted responsibilities are signal green, guitar active influence is signal green
  - Mobile (375×812): same sections — verify consistent treatment

- [ ] **Step 3: Dispatch full 5-agent review battery (ALL required before stamp)**

  Run all 5 in parallel — CLAUDE.md mandates this before every push, no agent optional:
  - `pr-review-toolkit:review-pr` — code correctness, CSS specificity, missed migrations
  - `security-auditor` — confirm no security surface touched
  - `accessibility-tester` — verify no a11y regressions from `data-*` attribute additions
  - `performance-engineer` — verify no paint regression from attribute selector changes
  - `dependency-manager` — confirm no dependency changes

  Fix all Critical/Important findings before proceeding.

- [ ] **Step 4: Run review stamp and push**

  ```bash
  pnpm review:stamp
  git push
  ```

- [ ] **Step 5: Verify no remaining className ternary patterns in migrated files**

  ```bash
  grep -rn "className={\`\${" \
    components/responsive/Module/ \
    components/sections/PerfReceiptsSection/ \
    components/sections/ResponsibilitiesSection/ \
    components/sections/DawMixerSection/ \
    components/sections/GuitarSection/
  ```
  Expected: zero results from the migrated visual-variant patterns. (Index-based dot fills and audio functional states are excluded by design — they may still appear in DawMixer/Guitar for non-migrated patterns.)
