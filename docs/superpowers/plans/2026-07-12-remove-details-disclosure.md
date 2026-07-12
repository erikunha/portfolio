# Remove `<details>/<summary>` Disclosure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove collapsible disclosure from the codebase entirely — page sections and design-system code previews render expanded, always.

**Architecture:** `Module.tsx`'s `<details open>` + `<summary>` becomes `<section tabIndex={-1} aria-labelledby>` + a non-interactive `<header>`, and the CSS collapse machinery is *merged into unconditional rules* rather than deleted (the base state is collapsed — a naive delete blanks the site). The now-unreachable `module:open` event path (Dock → AppShell → `lib/events`) is removed as a unit. `Preview.tsx` renders its build-time-injected source unconditionally.

**Tech Stack:** Next.js 16 RSC, React 19, TypeScript strict, Tailwind v4, Vitest, Playwright.

## Global Constraints

- **No magic values.** Literals go into named consts/types in **separate, reusable modules** — not inlined in components. Test files are exempt.
- **Bare code.** No prose comments. Only machine directives (`biome-ignore`, `@ts-*`).
- **RSC by default.** No new `'use client'`. This change only *removes* client code.
- **Perf budgets are non-negotiable.** `content-visibility` deferral (`data-cv-defer` / `module-deferred`) must survive untouched.
- **A11y:** WCAG 2.1 AA, axe-core clean, Lighthouse a11y = 100.
- **Never `git add .`** — stage only the files named in each task.
- **Spec:** `docs/superpowers/specs/2026-07-12-remove-details-disclosure-design.md` (architect gate: PASS).

## File Structure

| File | Responsibility |
|---|---|
| `components/responsive/Module/module.constants.ts` | **CREATE** — id builders + shared strings for Module |
| `components/responsive/Module/Module.tsx` | **MODIFY** — `<details>`→`<section>`, `<summary>`→`<header>`, drop chevron |
| `components/responsive/Module/Module.test.tsx` | **MODIFY** — behavioral assertions |
| `app/css/components.css:58-138` | **MODIFY** — merge `[open]` rules; delete chevron + collapse scaffolding |
| `components/responsive/Dock/Dock.client.tsx` | **MODIFY** — drop the DETAILS branch + import |
| `components/AppShell/AppShell.client.tsx` | **MODIFY** — drop the `module:open` effect |
| `lib/events.ts` | **MODIFY** — drop `dispatchModuleOpen` + its `WindowEventMap` entry |
| `__tests__/events.test.ts` | **DELETE** — entire file tests `dispatchModuleOpen` |
| `__tests__/appshell-module-open.test.tsx` | **DELETE** — tests the removed listener |
| `__tests__/dock.test.tsx` | **MODIFY** — drop the DETAILS test, keep the scroll test |
| `__tests__/sections-smoke.test.tsx` | **MODIFY** — 18 `summary` queries → `h2` |
| `__tests__/perf-receipts-section.test.tsx`, `__tests__/readme-section.test.tsx` | **MODIFY** — 1 each |
| `app/design-system/_components/preview.constants.ts` | **CREATE** — source label + `<pre>` aria-label |
| `app/design-system/_components/Preview.tsx` | **MODIFY** — always render source; focusable `<pre>` |
| `tests/e2e/design-system-pages.spec.ts:19` | **MODIFY** — no toggle; source always visible |
| `tests/visual/visual.spec.ts:118-124` | **MODIFY** — drop the `.open = true` shim |
| `ARCHITECTURE.md`, `docs/04`, `docs/08`, `docs/09`, `DECISIONS.md` | **MODIFY** — doc drift + ADR |
| baselines (both sets) | **REGEN** — darwin + linux (visual), darwin (DS components) |

---

### Task 1: Shared constants (no magic values)

**Files:**
- Create: `components/responsive/Module/module.constants.ts`
- Create: `app/design-system/_components/preview.constants.ts`

**Interfaces:**
- Produces: `moduleHeaderId(id: string): string`, `moduleBodyId(id: string): string`, `type ModuleVariant`; `PREVIEW_SOURCE_LABEL`, `PREVIEW_SOURCE_ARIA_LABEL`.

These id builders are the single source of truth for the `aria-labelledby` ↔ `<h2 id>` contract. Both the component and its tests import them, so the two can never drift (spec failure mode 4).

- [ ] **Step 1: Create the Module constants**

`components/responsive/Module/module.constants.ts`:

```ts
export const MODULE_HEADER_ID_SUFFIX = 'header';
export const MODULE_BODY_ID_SUFFIX = 'body';

export type ModuleVariant = 'green';

export function moduleHeaderId(id: string): string {
  return `${id}-${MODULE_HEADER_ID_SUFFIX}`;
}

export function moduleBodyId(id: string): string {
  return `${id}-${MODULE_BODY_ID_SUFFIX}`;
}
```

- [ ] **Step 2: Create the Preview constants**

`app/design-system/_components/preview.constants.ts`:

```ts
export const PREVIEW_SOURCE_LABEL = 'SOURCE';
export const PREVIEW_SOURCE_ARIA_LABEL = 'Component source code';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add components/responsive/Module/module.constants.ts app/design-system/_components/preview.constants.ts
git commit -m "refactor(module): extract module and preview constants"
```

---

### Task 2: `Module.tsx` — `<details>` → `<section>`

**Files:**
- Modify: `components/responsive/Module/Module.tsx`
- Modify: `components/responsive/Module/Module.test.tsx`

**Interfaces:**
- Consumes: `moduleHeaderId`, `moduleBodyId`, `ModuleVariant` from Task 1.

`tabIndex={-1}` is **required**: `DesktopTopbar.client.tsx` links to `#sec-*` with a plain `href` and no `preventDefault`, so the browser does native fragment navigation. `<details>` is focusable (focus lands on it today); a bare `<section>` is not. `tabIndex={-1}` adds **zero tab stops** and restores programmatic focusability. Same pattern as `<main id="main-content" tabIndex={-1}>` in `app/page.tsx`.

- [ ] **Step 1: Write the failing tests**

Replace the body of `components/responsive/Module/Module.test.tsx` with:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Module } from './Module';
import { moduleHeaderId } from './module.constants';

function render(ui: React.ReactElement): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(ui);
  return container;
}

describe('Module', () => {
  it('renders a section, never a details or summary', () => {
    const container = render(
      <Module id="sec-x" header="HEADER">
        body
      </Module>,
    );

    expect(container.querySelector('section#sec-x')).not.toBeNull();
    expect(container.querySelector('details')).toBeNull();
    expect(container.querySelector('summary')).toBeNull();
  });

  it('names the section via aria-labelledby pointing at the h2', () => {
    const container = render(
      <Module id="sec-x" header="HEADER">
        body
      </Module>,
    );

    const section = container.querySelector('section');
    const labelledBy = section?.getAttribute('aria-labelledby');

    expect(labelledBy).toBe(moduleHeaderId('sec-x'));
    expect(container.querySelector(`h2#${labelledBy}`)?.textContent).toContain('HEADER');
  });

  it('is programmatically focusable for hash navigation without adding a tab stop', () => {
    const container = render(
      <Module id="sec-x" header="HEADER">
        body
      </Module>,
    );

    expect(container.querySelector('section')?.getAttribute('tabindex')).toBe('-1');
  });

  it('renders body content with no interaction required', () => {
    const container = render(
      <Module id="sec-x" header="HEADER">
        <p data-testid="child">visible</p>
      </Module>,
    );

    expect(container.querySelector('[data-testid="child"]')?.textContent).toBe('visible');
  });

  it('renders unique header ids when the same component renders twice', () => {
    const container = render(
      <>
        <Module id="sec-a" header="A">
          a
        </Module>
        <Module id="sec-b" header="B">
          b
        </Module>
      </>,
    );

    expect(container.querySelector(`h2#${moduleHeaderId('sec-a')}`)).not.toBeNull();
    expect(container.querySelector(`h2#${moduleHeaderId('sec-b')}`)).not.toBeNull();
  });

  it('passes data-variant="green" to bodyContent when variant="green"', () => {
    const container = render(
      <Module id="sec-x" header="H" variant="green">
        body
      </Module>,
    );

    expect(container.querySelector('[data-variant="green"]')).not.toBeNull();
  });

  it('renders no data-variant attribute when variant is not set', () => {
    const container = render(
      <Module id="sec-x" header="H">
        body
      </Module>,
    );

    expect(container.querySelector('[data-variant]')).toBeNull();
  });

  it('adds data-cv-defer attribute when defer=true', () => {
    const container = render(
      <Module id="sec-x" header="H" defer>
        body
      </Module>,
    );

    expect(container.querySelector('section')?.getAttribute('data-cv-defer')).toBe('true');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test --run components/responsive/Module/Module.test.tsx`
Expected: FAIL — `section#sec-x` is null (the component still renders `<details>`).

- [ ] **Step 3: Implement**

Replace `components/responsive/Module/Module.tsx` with:

```tsx
import type { ReactNode } from 'react';
import { type ModuleVariant, moduleBodyId, moduleHeaderId } from './module.constants';

export type ModuleProps = {
  id: string;
  header: string;
  mobileHeader?: string;
  icon?: ReactNode;
  defer?: boolean | undefined;
  variant?: ModuleVariant;
  children: ReactNode;
};

export function Module({
  id,
  header,
  mobileHeader,
  icon,
  defer = false,
  variant,
  children,
}: ModuleProps) {
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={moduleHeaderId(id)}
      className={[
        'module-root',
        'mb-[18px] md:mb-10',
        'border border-primary-subtle bg-[rgba(0,0,0,0.22)] md:bg-transparent overflow-hidden md:overflow-visible',
        'md:border-0',
        defer ? 'module-deferred' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...(defer ? { 'data-cv-defer': 'true' } : {})}
    >
      <header
        className={[
          'flex items-center gap-2 w-full',
          'px-[14px] py-3 min-h-11 bg-glow-04 border-b border-primary-quiet',
          'md:px-0 md:py-0 md:min-h-0 md:bg-transparent md:border-b-0 md:mb-2',
        ].join(' ')}
      >
        <h2
          id={moduleHeaderId(id)}
          className="flex-1 flex items-center gap-2 text-primary-500 font-mono text-xs max-md:text-[10px] md:text-[12px] font-medium tracking-[0.14em] md:tracking-[0.1em] uppercase m-0"
        >
          {icon ? (
            <span
              className="inline-flex w-5 h-5 items-center justify-center text-primary-500 [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:stroke-current [&_svg]:fill-none [&_svg]:[stroke-width:1.4]"
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
          <span className="hidden md:inline">{header}</span>
          <span className="md:hidden">{mobileHeader ?? header}</span>
        </h2>
      </header>
      <div className="module-body" id={moduleBodyId(id)}>
        <div className="module-body-content" data-variant={variant}>
          {children}
        </div>
      </div>
    </section>
  );
}
```

Note the three deletions: the ▸ chevron span, the `[list-style:none]` / `cursor-pointer` / `focus-visible:outline-*` summary classes, and the inner `<div className="min-h-0 overflow-hidden">` (pure collapse scaffolding — a permanent `overflow: hidden` would clip focus rings on the contact form inside).

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test --run components/responsive/Module/Module.test.tsx`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add components/responsive/Module/Module.tsx components/responsive/Module/Module.test.tsx
git commit -m "refactor(module): render sections as section, not details"
```

---

### Task 3: CSS — merge the `[open]` rules (site-breaking if wrong)

**Files:**
- Modify: `app/css/components.css:58-138`

**This is the dangerous task.** The base state is *collapsed*: `.module-body` is `grid-template-rows: 0fr` and `.module-body-content` is `opacity: 0`. A `<section>` has no `open` attribute, so if you **delete** the `[open]` rules (the natural reading) every section body stays at **zero height and zero opacity — the whole site's content disappears.** Merge each pair into one unconditional rule carrying the *expanded* value. Unit tests render without CSS and cannot catch this; only the visual baselines can.

- [ ] **Step 1: Replace lines 58-138**

Delete `.module-root::details-content`, the `.module-body` rule (pure collapse scaffolding: grid, `grid-template-rows`, its transition, `contain`, and the Chrome-131 `min-height` override that existed only for `::details-content`), both `.module-chevron` rules, and both reduced-motion blocks (they guarded transitions that no longer exist).

Replace with:

```css
  .module-deferred {
    content-visibility: auto;

    contain-intrinsic-size: auto 520px;
  }

  .module-body-content {
    padding: 14px;
    color: var(--color-tertiary-50);
    background: transparent;
  }

  @media (min-width: 769px) {
    .module-body-content {
      padding: 18px;
      border: 1px solid var(--color-primary-subtle);
    }
  }

  .module-body-content[data-variant="green"] {
    background: var(--color-glow-05);
  }
```

The desktop `border` is **merged in** from the old `@media (min-width: 769px) .module-root[open] .module-body-content` rule — dropping it would silently remove every desktop section border.

- [ ] **Step 2: Verify no disclosure CSS survives**

Run:
```bash
grep -nE '\[open\]|::details-content|module-chevron' app/css/components.css
```
Expected: **no output** (exit 1).

- [ ] **Step 3: Verify the body actually renders with height**

Run: `pnpm build && DEPLOY_SALT=test pnpm start &`, then:
```bash
pnpm exec playwright test --project=chromium tests/e2e/cross-cutting.spec.ts
```
Expected: PASS. Then confirm a section body has non-zero height:
```bash
node -e "console.log('manual check: open http://localhost:3000 and confirm section bodies are visible')"
```
Kill the server: `lsof -tnP -iTCP:3000 -sTCP:LISTEN | xargs kill`

- [ ] **Step 4: Commit**

```bash
git add app/css/components.css
git commit -m "refactor(module): merge open-state css into unconditional rules"
```

---

### Task 4: Remove the `module:open` event path

**Files:**
- Modify: `components/responsive/Dock/Dock.client.tsx`
- Modify: `components/AppShell/AppShell.client.tsx`
- Modify: `lib/events.ts`
- Delete: `__tests__/events.test.ts`
- Delete: `__tests__/appshell-module-open.test.tsx`
- Modify: `__tests__/dock.test.tsx`

These three edits ship **together**: removing `dispatchModuleOpen` while `Dock` still imports it fails `typecheck`/`build` on a dangling import.

- [ ] **Step 1: Delete the two dead test files**

```bash
git rm __tests__/events.test.ts __tests__/appshell-module-open.test.tsx
```

Both cover a feature that ceases to exist (`events.test.ts` is entirely `describe('dispatchModuleOpen')`). No surviving behavior loses coverage — the Dock's scroll is covered in Step 2.

- [ ] **Step 2: Remove the DETAILS test from `__tests__/dock.test.tsx`, keep the scroll test**

Delete the whole `it('clicking a hash link whose target is a DETAILS element dispatches module:open', …)` block. Keep the existing test that asserts `scrolledIntoView` is the target section — that is now the sole guarantee Dock navigation still works.

- [ ] **Step 3: Run to verify the suite fails on the dangling import**

Run: `pnpm test --run __tests__/dock.test.tsx`
Expected: PASS (Dock still compiles — we have not touched it yet).

- [ ] **Step 4: Implement — `Dock.client.tsx`**

Remove the `dispatchModuleOpen` import (line 3) and the DETAILS branch, leaving:

```tsx
  const onJump = (href: string, target?: string) => (e: React.MouseEvent) => {
    if (!href.startsWith('#')) return;
    e.preventDefault();
    if (!target) return;
    const el = document.getElementById(target);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
```

- [ ] **Step 5: Implement — `AppShell.client.tsx`**

Delete the entire `useEffect` that listens for `module:open` (the handler, the `HTMLDetailsElement` narrowing, `addEventListener`/`removeEventListener`). Remove the now-unused `useEffect` import if nothing else uses it.

- [ ] **Step 6: Implement — `lib/events.ts`**

Delete `dispatchModuleOpen` and the `'module:open'` line from `WindowEventMap`, leaving:

```ts
declare global {
  interface WindowEventMap {
    'sysfail:start': CustomEvent;
    'sysfail:end': CustomEvent;
    'shell-cmd-run': CustomEvent;
    'hero:sysfail:show': CustomEvent;
    'hero:sysfail:hide': CustomEvent;
  }
}

export {};
```

- [ ] **Step 7: Verify**

Run: `pnpm typecheck && pnpm test --run __tests__/dock.test.tsx`
Expected: typecheck exit 0; dock tests PASS.

Run:
```bash
grep -rn 'dispatchModuleOpen\|module:open\|HTMLDetailsElement' components/ app/ lib/ __tests__/
```
Expected: **no output**.

- [ ] **Step 8: Commit**

```bash
git add components/responsive/Dock/Dock.client.tsx components/AppShell/AppShell.client.tsx lib/events.ts __tests__/dock.test.tsx
git commit -m "refactor(module): remove the module:open event path"
```

---

### Task 5: Rewrite the section test suites

**Files:**
- Modify: `__tests__/sections-smoke.test.tsx` (18 `summary` queries)
- Modify: `__tests__/perf-receipts-section.test.tsx` (1)
- Modify: `__tests__/readme-section.test.tsx` (1)

These are the *primary* header-text assertions for 11+ sections. Left alone, `pnpm test` reds immediately.

- [ ] **Step 1: Run to see the failures**

Run: `pnpm test --run __tests__/sections-smoke.test.tsx __tests__/perf-receipts-section.test.tsx __tests__/readme-section.test.tsx`
Expected: FAIL — `container.querySelector('summary')` returns `null`.

- [ ] **Step 2: Replace every `summary` query with `h2`**

The header text now lives in the `<h2>` inside `<header>`. Mechanical substitution across all three files:

```tsx
// before
const summary = container.querySelector('summary');
expect(summary?.textContent).toContain('CAT ~/.COMMUNITY');
// after
const heading = container.querySelector('h2');
expect(heading?.textContent).toContain('CAT ~/.COMMUNITY');
```

```tsx
// before
expect(container.querySelector('summary')).not.toBeNull();
// after
expect(container.querySelector('h2')).not.toBeNull();
```

Apply to all 18 occurrences in `sections-smoke.test.tsx` and the 1 each in the other two files. Do not change the expected header strings.

- [ ] **Step 3: Run to verify they pass**

Run: `pnpm test --run __tests__/sections-smoke.test.tsx __tests__/perf-receipts-section.test.tsx __tests__/readme-section.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add __tests__/sections-smoke.test.tsx __tests__/perf-receipts-section.test.tsx __tests__/readme-section.test.tsx
git commit -m "test(module): assert section headings instead of summary"
```

---

### Task 6: `Preview.tsx` — always render the source

**Files:**
- Modify: `app/design-system/_components/Preview.tsx`
- Modify: `tests/e2e/design-system-pages.spec.ts:19-25`

**Do not delete the `source` prop.** It is populated at build time by `lib/mdx/remark-preview-source.mjs` (a remark plugin wired in `next.config.ts`), which is why the MDX call sites pass only `id` yet the prerendered page carries 9 `<details>` and 18 `VIEW SOURCE`.

The `<pre>` is `overflow-x-auto` — a horizontally scrollable region. Hidden inside a collapsed `<details>` today, axe skips it. Rendering it unconditionally makes axe's `scrollable-region-focusable` rule apply (WCAG 2.1.1), and axe gates all five `/design-system/*` routes. It needs `tabIndex={0}` + `aria-label`. **No `role="region"`** — the rule needs focusability only, and the role would promote ~6 code blocks to landmarks.

- [ ] **Step 1: Update the e2e test to the new contract**

In `tests/e2e/design-system-pages.spec.ts`, replace the `Preview component renders live and source toggle` test with:

```ts
test('Preview renders the live component and its source without interaction', async ({
  page,
}) => {
  await page.goto('/design-system/components');
  const preview = page.getByTestId('ds-preview').first();
  await expect(preview).toBeVisible();

  const source = preview.locator('pre').first();
  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute('tabindex', '0');

  expect(await page.locator('details').count()).toBe(0);
});
```

- [ ] **Step 2: Implement**

Replace the `{source != null && (…)}` block in `app/design-system/_components/Preview.tsx`:

```tsx
import type { ReactNode } from 'react';
import { TerminalPanel } from '@/design-system';
import { PREVIEW_SOURCE_ARIA_LABEL, PREVIEW_SOURCE_LABEL } from './preview.constants';

type PreviewProps = {
  id?: string;
  source?: string;
  children: ReactNode;
};

export function Preview({ id, source, children }: PreviewProps) {
  return (
    <div id={id} className="ds-preview" data-testid="ds-preview">
      <TerminalPanel className="my-4">
        <div className="p-6 flex flex-wrap gap-3 items-start">{children}</div>
        {source != null && (
          <div className="border-t border-primary-border">
            <p className="px-6 py-1.5 m-0 font-mono text-xs tracking-widest text-primary-400 uppercase">
              {PREVIEW_SOURCE_LABEL}
            </p>
            <pre
              tabIndex={0}
              aria-label={PREVIEW_SOURCE_ARIA_LABEL}
              className="m-0 px-6 py-4 overflow-x-auto font-mono text-xs text-tertiary-50 border-t border-dashed border-primary-border"
            >
              <code>{source}</code>
            </pre>
          </div>
        )}
      </TerminalPanel>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `pnpm build && DEPLOY_SALT=test pnpm start &` then
`pnpm exec playwright test --project=chromium tests/e2e/design-system-pages.spec.ts`
Expected: PASS.

Run the a11y gate (this is the rule that could red):
`pnpm exec playwright test --project=chromium tests/a11y/axe.spec.ts`
Expected: PASS — 7 tests, including all 5 `/design-system/*` routes.

Kill the server: `lsof -tnP -iTCP:3000 -sTCP:LISTEN | xargs kill`

- [ ] **Step 4: Commit**

```bash
git add app/design-system/_components/Preview.tsx tests/e2e/design-system-pages.spec.ts
git commit -m "refactor(design-system): always render preview source, focusable pre"
```

---

### Task 7: Drop the visual-spec details shim

**Files:**
- Modify: `tests/visual/visual.spec.ts:118-124`

- [ ] **Step 1: Delete the shim**

In test `5 — hottest takes section matches baseline`, delete the `page.evaluate` block that does:

```ts
const el = document.getElementById('sec-hottest-takes');
if (el && el.tagName.toLowerCase() === 'details') {
  (el as HTMLDetailsElement).open = true;
}
```

It is now a permanent no-op. Keep the `waitForSelector`, `evaluate(() => document.fonts.ready)`, `stripVolatileChrome`, and the snapshot call.

- [ ] **Step 2: Verify no details references remain in tests**

Run: `grep -rn 'HTMLDetailsElement\|<details' tests/`
Expected: **no output**.

- [ ] **Step 3: Commit**

```bash
git add tests/visual/visual.spec.ts
git commit -m "test(visual): drop the details-open shim"
```

---

### Task 8: Docs + ADR

**Files:**
- Modify: `ARCHITECTURE.md:216`
- Modify: `docs/04-components-and-state.md:29,39,92,93,100`
- Modify: `docs/08-performance-and-accessibility.md:65`
- Modify: `docs/09-hidden-knowledge.md:27,51`
- Modify: `DECISIONS.md`

STANDARDS Ch.10 gates this: doc claims must match live code.

- [ ] **Step 1: Fix the stale claims**

- `ARCHITECTURE.md:216` — `lib/events.ts # typed dispatchModuleOpen helper` → describe the remaining events (no `dispatchModuleOpen`).
- `docs/04:29` — mermaid node `Module (RSC wrapper: native details/summary)` → `Module (RSC wrapper: section + header)`.
- `docs/04:39` — rewrite. **The existing sentence is already false**: it claims "Desktop CSS hides the chevron so it reads as a plain `<h2>`", but no rule hides `.module-chevron` at any breakpoint. State the new truth: a `<section tabIndex={-1} aria-labelledby>` with a non-interactive `<header>`; `defer` still drives `content-visibility`.
- `docs/04:92,93` — remove `module:open` from the events node and delete the `Dock -->|module:open| AppShell` edge.
- `docs/04:100` — remove the `module:open` / "flips the right `<details>`" clause.
- `docs/08:65` — `sections are native <details>/<summary>` → `sections are <section> with an <h2>, named via aria-labelledby`.
- `docs/09:27` — delete the Dock/`module:open` delegated-listener bullet (the mechanism is gone).
- `docs/09:51` — delete the "one details element per viewport" bullet.

**Do not touch** `docs/superpowers/plans/*`, `docs/audit/*`, older specs, or existing dated ADR bullets — those are point-in-time history.

- [ ] **Step 2: Add the ADR**

Prepend to `DECISIONS.md` (above the most recent `##` section):

```markdown
## 2026-07-12 - Collapsible sections removed; Module renders a plain <section>

- **2026-07-12** · **`<details>/<summary>` removed from the codebase; `Module` renders `<section tabIndex={-1} aria-labelledby>` + a non-interactive `<header>`, and the design-system `Preview` renders its source unconditionally.** The `<details>` was hardcoded `open`, so the default was already fully expanded — the element only let a visitor *collapse* a section, and the ▸ chevron advertised an interaction that added nothing, while costing a disclosure widget plus 20 focusable `<summary>` tab stops. Removing it also retires the `module:open` path (`Dock` → `lib/events.ts` → the `AppShell` delegated listener), which existed solely to re-open a collapsed section before scrolling; the Dock still scrolls, so navigation is unchanged. **The CSS was the trap:** the base state was *collapsed* (`.module-body { grid-template-rows: 0fr }`, `.module-body-content { opacity: 0 }`), with the expanded values living only under `.module-root[open]`. A `<section>` has no `open` attribute, so deleting (or naively "de-qualifying") those rules would have left every section body at zero height and zero opacity — blanking the entire site with no error, and unit tests render without CSS so only the visual baselines would have caught it. The pairs were **merged** into unconditional rules, and the collapse scaffolding (grid rows, `contain`, the inner `overflow-hidden` div — a focus-ring clipping hazard around the contact form) deleted outright. `tabIndex={-1}` is load-bearing, not cosmetic: `DesktopTopbar` uses native fragment navigation with no `preventDefault`, and `<details>` was focusable while a bare `<section>` is not, so hash jumps would have stopped moving focus (weakest in the two gated WebKit projects); `-1` adds zero tab stops. The design-system `<pre>` gained `tabIndex={0}` + `aria-label` because rendering it unconditionally exposes it to axe's `scrollable-region-focusable` rule (WCAG 2.1.1) on all five gated `/design-system/*` routes — `role="region"` was deliberately NOT added, as the rule needs focusability only and the role would promote ~6 code blocks to landmarks. `Preview`'s `source` prop is retained: it is injected at build time by `lib/mdx/remark-preview-source.mjs`, so a `grep "source="` at the MDX call sites misleadingly finds nothing. Annotates the 2026-05-18 `content-visibility` ADR (which referenced `details.module--mobile`); the deferral itself is unchanged. _Reversible: restore `<details open>` + `<summary>`, re-add the `[open]`-qualified CSS, and reinstate the `module:open` path — but regenerate both baseline sets, and note nothing consumed the collapse affordance._
```

- [ ] **Step 3: Verify the doc-drift gate**

Run: `pnpm check:doc-drift`
Expected: `✓ doc-drift: N paths checked, 0 stale`

- [ ] **Step 4: Commit**

```bash
git add ARCHITECTURE.md docs/04-components-and-state.md docs/08-performance-and-accessibility.md docs/09-hidden-knowledge.md DECISIONS.md
git commit -m "docs(module): sync docs to the section-based Module"
```

---

### Task 9: Regenerate BOTH baseline sets

**Files:**
- Regen: `tests/visual/visual.spec.ts-snapshots/*` (darwin **and** linux)
- Regen: `tests/e2e/design-system-components.spec.ts-snapshots/*` (darwin only — the spec is `testIgnore`d on Ubuntu)

Invoke `.claude/skills/visual-baseline-regen`. Expect **larger diffs than a glyph delete**: the 24px chevron set the desktop module-header row height, so removing it shrinks every header and shifts everything below it upward, cumulatively. `hero-above-fold` sits above every Module and must NOT change.

- [ ] **Step 1: Darwin regen (both specs)**

```bash
lsof -tnP -iTCP:3000 -sTCP:LISTEN | xargs kill 2>/dev/null
pnpm build
DEPLOY_SALT=test pnpm start &
# wait for :3000, then:
pnpm test:e2e --project=chromium --project=chromium-mobile --project=webkit-desktop --project=webkit-mobile tests/visual/visual.spec.ts --update-snapshots
pnpm test:e2e --project=chromium-components tests/e2e/design-system-components.spec.ts --update-snapshots
```

- [ ] **Step 2: INSPECT every regenerated PNG before committing**

Read each changed PNG. Confirm: the chevron is gone; the header reads as a plain heading; **section bodies are visible with real content** (this is the check that catches a botched Task 3 — a blank body means the CSS merge failed); `hero-above-fold` is unchanged.

- [ ] **Step 3: Linux regen for `visual.spec.ts` (CI dispatch)**

```bash
gh workflow run "CI" -f update_visual_baselines=true --ref refactor/remove-details-disclosure
# wait for the run, then download each visual-baselines-<project> artifact
# and copy each project's own *-linux.png into tests/visual/visual.spec.ts-snapshots/
```

- [ ] **Step 4: Commit both platforms together**

```bash
git add tests/visual/visual.spec.ts-snapshots tests/e2e/design-system-components.spec.ts-snapshots
git commit -m "test(visual): regen baselines for the section-based Module"
```

---

### Task 10: Final sweep and full gates

- [ ] **Step 1: Prove zero disclosure survives**

```bash
grep -rnE '<details|<summary|::details-content|\[open\]|HTMLDetailsElement|dispatchModuleOpen' \
  components/ app/ lib/ design-system/ tests/ __tests__/
```
Expected: **no output**.

- [ ] **Step 2: Full local CI**

Run: `pnpm ci:local`
Expected: PASS (lint, typecheck, content, client-naming, harness-size, tests).

- [ ] **Step 3: Runtime gates**

Run: `pnpm gates:runtime`
Expected: `[gates:runtime] All runtime gates passed.` — LHCI desktop + mobile (perf ≥95/≥90, a11y = 100), axe-core on all 5 DS routes + homepage, e2e functional.

- [ ] **Step 4: Bundle check**

Run: `pnpm bundle-check`
Expected: OK. Client JS should **shrink** (the AppShell listener and `lib/events` export are gone).

- [ ] **Step 5: Review battery + PR**

Run the 5-agent battery, `pnpm review:stamp`, push, then `pnpm ready-for-pr` and open the PR.

---

## Self-Review

**Spec coverage:** §1 Module→Task 2 · §2 CSS→Task 3 · §3 `module:open`→Task 4 · §4 Preview→Task 6 · §5 constants→Task 1 · §6 tests→Tasks 2/4/5/6/7 · §7 docs→Task 8 · baselines→Task 9 · verification→Task 10. Failure modes 1(T3) 2(T6) 2b(T2) 2c(T2) 3(T4) 4(T1/T2) 5(T2) 6(T2) 7(T4) 8(T6) 9(T9) 10(T8). No gaps.

**Placeholders:** none — every code step carries real code.

**Type consistency:** `moduleHeaderId` / `moduleBodyId` / `ModuleVariant` (Task 1) are used verbatim in Tasks 2 and the Module tests. `PREVIEW_SOURCE_LABEL` / `PREVIEW_SOURCE_ARIA_LABEL` (Task 1) used verbatim in Task 6.
