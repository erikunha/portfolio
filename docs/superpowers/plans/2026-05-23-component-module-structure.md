# Component Module Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every component owns its complete test surface co-located in its folder — canonical shape is `ComponentName/{ComponentName.tsx, .module.css, .test.tsx, .e2e.ts, index.ts}`.

**Architecture:** Flat files in `components/sections/`, `components/client/`, and `components/responsive/` are converted to per-component folders. The folder name matches the old filename so import resolution through `index.ts` barrels is transparent to all consumers. Playwright gains 4 new projects targeting `components/**/*.e2e.ts`; Vitest coverage is extended to `design-system/components/**`.

**Tech Stack:** Next.js App Router, Playwright, Vitest, TypeScript strict, CSS Modules, `git mv`

---

## Import transparency rule (read first)

When moving `Hero.tsx` → `Hero/Hero.tsx`, creating `Hero/index.ts` that re-exports means any consumer importing `@/components/sections/Hero` or `'../sections/Hero'` will resolve to `Hero/index.ts` instead of the old `Hero.tsx` — **same public API, zero consumer-side import changes needed**, unless the file being moved itself contains relative imports that traverse directories (e.g. `'../HeroStats'` from `sections/Hero.tsx` becomes `'../../HeroStats'` from `sections/Hero/Hero.tsx`).

CSS module files cannot be barrel-exported. Any test that directly imports `@/components/sections/Hero.module.css` must update that path after the CSS file moves to `sections/Hero/Hero.module.css`.

---

## Task 1: Config — Playwright E2E projects + Vitest coverage

**Files:**
- Modify: `playwright.config.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Add 4 Playwright projects for co-located E2E**

Replace the `projects` array in `playwright.config.ts`:

```ts
import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  projects: [
    // ── Existing projects (testDir: './tests', unchanged) ────────────────
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium' },
      testMatch:
        /tests\/e2e\/(contact|ask|visual|cross-cutting|design-system-components)\.spec\.ts$/,
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } },
      testMatch:
        /tests\/e2e\/(contact|ask|visual|cross-cutting|design-system-components)\.spec\.ts$/,
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 14'] },
      testMatch:
        /tests\/e2e\/(contact|ask|visual|cross-cutting|design-system-components)\.spec\.ts$/,
    },

    // ── Co-located component E2E (testDir: '.', scoped to *.e2e.ts) ─────
    // Each project mirrors the 4-browser matrix. testDir '.' lets Playwright
    // discover specs outside ./tests. testMatch scopes discovery to *.e2e.ts
    // only — prevents double-running existing *.spec.ts files.
    {
      name: 'chromium-components',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      testDir: '.',
      testMatch: /\/(components|app)\/.*\.e2e\.ts$/,
    },
    {
      name: 'chromium-mobile-components',
      use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium' },
      testDir: '.',
      testMatch: /\/(components|app)\/.*\.e2e\.ts$/,
    },
    {
      name: 'webkit-desktop-components',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } },
      testDir: '.',
      testMatch: /\/(components|app)\/.*\.e2e\.ts$/,
    },
    {
      name: 'webkit-mobile-components',
      use: { ...devices['iPhone 14'] },
      testDir: '.',
      testMatch: /\/(components|app)\/.*\.e2e\.ts$/,
    },
  ],
});
```

- [ ] **Step 2: Add design-system/components to Vitest coverage**

In `vitest.config.ts`, update `coverage.include`:

```ts
// Before:
include: ['lib/**', 'components/**', 'app/**'],

// After:
include: ['lib/**', 'components/**', 'app/**', 'design-system/components/**'],
```

- [ ] **Step 3: Verify config compiles**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts vitest.config.ts
git commit -m "feat(test): add co-located E2E Playwright projects + DS coverage"
```

---

## Task 2: Hero folder — migrate + merge unit tests + new E2E

**Files:**
- Move: `components/sections/Hero.tsx` → `components/sections/Hero/Hero.tsx`
- Move: `components/sections/Hero.module.css` → `components/sections/Hero/Hero.module.css`
- Create: `components/sections/Hero/index.ts`
- Create: `components/sections/Hero/Hero.test.tsx` (merge of hero-heading + hero-rsc)
- Create: `components/sections/Hero/Hero.e2e.ts`
- Delete: `__tests__/hero-heading.test.ts`, `__tests__/hero-rsc.test.ts`

- [ ] **Step 1: Create folder and move files**

```bash
mkdir components/sections/Hero
git mv components/sections/Hero.tsx components/sections/Hero/Hero.tsx
git mv components/sections/Hero.module.css components/sections/Hero/Hero.module.css
```

- [ ] **Step 2: Update relative imports inside Hero.tsx**

`Hero.tsx` currently imports `'../client/HeroBootAnimation'`, `'../client/HeroSystemFailure'`, and `'../HeroStats'`. After moving one level deeper, all three `..` references need an extra `../`:

```tsx
// Change these three imports in components/sections/Hero/Hero.tsx:
import { HeroBootAnimation } from '../../client/HeroBootAnimation';
import { HeroSystemFailure } from '../../client/HeroSystemFailure';
import { HeroStats } from '../../HeroStats';
// All other imports (content, design-system, styles) are unchanged.
// './Hero.module.css' still resolves correctly since CSS moved with the component.
```

- [ ] **Step 3: Create barrel export**

```ts
// components/sections/Hero/index.ts
export { Hero } from './Hero';
```

- [ ] **Step 4: Create merged unit test**

```tsx
// components/sections/Hero/Hero.test.tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Hero } from './Hero';
import styles from './Hero.module.css';

function renderHeroDom(): Document {
  const html = renderToStaticMarkup(createElement(Hero));
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

const renderHero = () => renderToStaticMarkup(createElement(Hero));

describe('Hero headings', () => {
  it('renders an h1 element', () => {
    const doc = renderHeroDom();
    expect(doc.querySelectorAll('h1').length).toBeGreaterThan(0);
  });

  it('the desktop h1 lives inside the bio panel', () => {
    const doc = renderHeroDom();
    const desktop = doc.querySelector(`.${styles.desktop as string}`);
    expect(desktop).not.toBeNull();
    const bioHeading = desktop?.querySelector(`.${styles.bio as string} h1.${styles.name as string}`);
    expect(bioHeading).not.toBeNull();
    expect(bioHeading?.textContent).toContain('Erik');
  });

  it('the mobile h1 lives inside the inner wrapper', () => {
    const doc = renderHeroDom();
    const mobile = doc.querySelector(`.${styles.mobile as string}`);
    expect(mobile).not.toBeNull();
    const innerHeading = mobile?.querySelector(`.${styles.inner as string} h1.${styles.name as string}`);
    expect(innerHeading).not.toBeNull();
    expect(innerHeading?.textContent).toContain('Erik');
  });
});

describe('Hero RSC', () => {
  it('renders to static markup with no client runtime', () => {
    const html = renderHero();
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('Erik Henrique Alves Cunha');
  });

  it('renders both desktop and mobile variants', () => {
    const html = renderHero();
    expect(html).toContain(styles.desktop as string);
    expect(html).toContain(styles.mobile as string);
  });

  it('emits an h1 in each variant', () => {
    const html = renderHero();
    expect((html.match(/<h1/g) ?? []).length).toBe(2);
  });

  it('mounts HeroBootAnimation client islands as descendants', () => {
    const html = renderHero();
    const count = (html.match(new RegExp(`class="${styles.boot as string}"`, 'g')) ?? []).length;
    expect(count).toBe(2);
  });

  it('renders hire CTA anchors statically', () => {
    const html = renderHero();
    expect(html).toContain('https://www.linkedin.com/in/erikunha/');
    expect(html).toContain('https://github.com/erikunha');
  });
});
```

- [ ] **Step 5: Run unit tests to verify merge**

```bash
pnpm test -- --reporter=verbose components/sections/Hero
```

Expected: 8 tests pass.

- [ ] **Step 6: Delete source files from __tests__/**

```bash
git rm __tests__/hero-heading.test.ts __tests__/hero-rsc.test.ts
```

- [ ] **Step 7: Create Hero E2E spec**

```ts
// components/sections/Hero/Hero.e2e.ts
import { expect, test } from '@playwright/test';

test.describe('Hero — above the fold', () => {
  test('renders h1 heading visible on load', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Erik');
  });

  test('GitHub CTA link has correct href', async ({ page }) => {
    await page.goto('/');
    const githubLink = page.getByRole('link', { name: /github/i });
    await expect(githubLink).toHaveAttribute('href', 'https://github.com/erikunha');
  });

  test('LinkedIn CTA link has correct href', async ({ page }) => {
    await page.goto('/');
    const linkedinLink = page.getByRole('link', { name: /linkedin/i });
    await expect(linkedinLink).toHaveAttribute('href', 'https://www.linkedin.com/in/erikunha/');
  });

  test('role typewriter element is present with aria-live', async ({ page }) => {
    await page.goto('/');
    const live = page.locator('[aria-live]').first();
    await expect(live).toBeAttached();
  });
});
```

- [ ] **Step 8: Run full unit suite to verify no breakage**

```bash
pnpm test
```

Expected: 286 tests pass.

- [ ] **Step 9: Commit**

```bash
git add components/sections/Hero/ && git commit -m "refactor(hero): co-locate component, CSS, unit test, E2E in Hero/ folder"
```

---

## Task 3: HeroStats folder — migrate

**Files:**
- Move: `components/HeroStats.tsx` → `components/HeroStats/HeroStats.tsx`
- Move: `components/HeroStats.module.css` → `components/HeroStats/HeroStats.module.css`
- Create: `components/HeroStats/index.ts`
- Create: `components/HeroStats/HeroStats.test.tsx`
- Delete: `__tests__/HeroStats.test.ts`

- [ ] **Step 1: Create folder and move files**

```bash
mkdir components/HeroStats
git mv components/HeroStats.tsx components/HeroStats/HeroStats.tsx
git mv components/HeroStats.module.css components/HeroStats/HeroStats.module.css
```

- [ ] **Step 2: Verify HeroStats.tsx internal imports**

Open `components/HeroStats/HeroStats.tsx`. Verify:
- `'./HeroStats.module.css'` → resolves to the co-located CSS ✓
- Any `@/` imports are unchanged ✓
- No `..` relative imports to check (HeroStats is a leaf component)

No edits needed.

- [ ] **Step 3: Create barrel export**

```ts
// components/HeroStats/index.ts
export { HeroStats } from './HeroStats';
```

- [ ] **Step 4: Create co-located unit test**

```tsx
// components/HeroStats/HeroStats.test.tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { heroStats } from '@/content/perf-receipts';
import { HeroStats } from './HeroStats';

function getDOM() {
  const html = renderToStaticMarkup(createElement(HeroStats));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('HeroStats', () => {
  it('renders one item per heroStats entry', () => {
    const items = getDOM().querySelectorAll('[data-testid="hero-stats-item"]');
    expect(items).toHaveLength(heroStats.length);
  });

  it('each item renders a value element', () => {
    const values = getDOM().querySelectorAll('[data-testid="hero-stats-item"] dd');
    expect(values).toHaveLength(heroStats.length);
  });

  it('each item renders a label element', () => {
    const labels = getDOM().querySelectorAll('[data-testid="hero-stats-item"] dt');
    expect(labels).toHaveLength(heroStats.length);
  });

  it('first stat value matches heroStats[0].value', () => {
    const first = getDOM().querySelector('[data-testid="hero-stats-item"] dd');
    expect(first?.textContent).toBe(heroStats[0]?.value);
  });

  it('container carries aria-label for AT context', () => {
    const container = getDOM().querySelector('[data-testid="hero-stats"]');
    expect(container?.getAttribute('aria-label')).toBe('Impact at scale');
  });
});
```

- [ ] **Step 5: Run tests**

```bash
pnpm test -- --reporter=verbose components/HeroStats
```

Expected: 5 tests pass.

- [ ] **Step 6: Delete source file**

```bash
git rm __tests__/HeroStats.test.ts
```

- [ ] **Step 7: Run full suite**

```bash
pnpm test
```

Expected: 286 tests pass.

- [ ] **Step 8: Commit**

```bash
git add components/HeroStats/ && git commit -m "refactor(hero-stats): co-locate component, CSS, unit test in HeroStats/ folder"
```

---

## Task 4: AiMetricsSection folder — migrate

**Files:**
- Move: `components/sections/AiMetricsSection.tsx` → `components/sections/AiMetricsSection/AiMetricsSection.tsx`
- Move: `components/sections/AiMetricsSection.module.css` → `components/sections/AiMetricsSection/AiMetricsSection.module.css`
- Create: `components/sections/AiMetricsSection/index.ts`
- Create: `components/sections/AiMetricsSection/AiMetricsSection.test.tsx`
- Delete: `__tests__/ai-metrics-section.test.ts`

- [ ] **Step 1: Create folder and move files**

```bash
mkdir components/sections/AiMetricsSection
git mv components/sections/AiMetricsSection.tsx components/sections/AiMetricsSection/AiMetricsSection.tsx
git mv components/sections/AiMetricsSection.module.css components/sections/AiMetricsSection/AiMetricsSection.module.css
```

- [ ] **Step 2: Create barrel export**

```ts
// components/sections/AiMetricsSection/index.ts
export { AiMetricsSection, AiMetricsData } from './AiMetricsSection';
```

- [ ] **Step 3: Migrate unit test**

Copy the full content of `__tests__/ai-metrics-section.test.ts` to `components/sections/AiMetricsSection/AiMetricsSection.test.tsx`, then update the two import paths:

```ts
// Change:
import { AiMetricsData } from '@/components/sections/AiMetricsSection';
import { AiMetricsSection } from '@/components/sections/AiMetricsSection';
// To:
import { AiMetricsData, AiMetricsSection } from './AiMetricsSection';
```

Also update the CSS module import:
```ts
// Change:
import('@/components/sections/AiMetricsSection.module.css')
// To:
import('./AiMetricsSection.module.css')
```

- [ ] **Step 4: Run tests**

```bash
pnpm test -- --reporter=verbose components/sections/AiMetricsSection
```

Expected: all AiMetrics tests pass.

- [ ] **Step 5: Delete source file and commit**

```bash
git rm __tests__/ai-metrics-section.test.ts
git add components/sections/AiMetricsSection/
git commit -m "refactor(ai-metrics): co-locate component, CSS, unit test in AiMetricsSection/ folder"
```

---

## Task 5: LivePerfSection folder — new unit test

**Files:**
- Move: `components/sections/LivePerfSection.tsx` → `components/sections/LivePerfSection/LivePerfSection.tsx`
- Move: `components/sections/LivePerfSection.module.css` → `components/sections/LivePerfSection/LivePerfSection.module.css`
- Create: `components/sections/LivePerfSection/index.ts`
- Create: `components/sections/LivePerfSection/LivePerfSection.test.tsx`

Note: `__tests__/lighthouse-fallback.test.ts` tests `lib/lighthouse-scores.ts` (the constant), not this component. It stays in `__tests__/`. This test covers the component's render behavior when `getScores()` throws — a distinct contract.

- [ ] **Step 1: Create folder and move files**

```bash
mkdir components/sections/LivePerfSection
git mv components/sections/LivePerfSection.tsx components/sections/LivePerfSection/LivePerfSection.tsx
git mv components/sections/LivePerfSection.module.css components/sections/LivePerfSection/LivePerfSection.module.css
```

- [ ] **Step 2: Create barrel export**

```ts
// components/sections/LivePerfSection/index.ts
export { LivePerfSection } from './LivePerfSection';
```

- [ ] **Step 3: Write failing test**

```tsx
// components/sections/LivePerfSection/LivePerfSection.test.tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const getScoresMock = vi.fn();
vi.mock('@/lib/lighthouse-scores', () => ({
  getScores: getScoresMock,
  LIGHTHOUSE_FALLBACK: {
    performance: 0,
    accessibility: 0,
    bestPractices: 0,
    seo: 0,
    fetchedAt: '—',
  },
}));

async function renderPerfData(): Promise<string> {
  const { PerfData } = await import('./LivePerfSection');
  const element = await PerfData();
  return renderToStaticMarkup(element);
}

afterEach(() => {
  vi.resetModules();
  getScoresMock.mockReset();
});

describe('LivePerfSection — fetch-error fallback', () => {
  it('renders without throwing when getScores throws', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    await expect(renderPerfData()).resolves.not.toThrow();
  });

  it('does not render fabricated 100 scores on fetch failure', async () => {
    getScoresMock.mockRejectedValue(new Error('PSI API unavailable'));
    const html = await renderPerfData();
    expect(html).not.toContain('>100<');
  });
});
```

Note: `PerfData` is the inner async RSC. If `LivePerfSection.tsx` does not export it, export it: `export async function PerfData() { ... }` alongside the default wrapper.

- [ ] **Step 4: Run test to verify it fails or passes (new test — may pass immediately)**

```bash
pnpm test -- --reporter=verbose components/sections/LivePerfSection
```

If `PerfData` is not exported, add the export to `LivePerfSection.tsx` first, then re-run.

- [ ] **Step 5: Commit**

```bash
git add components/sections/LivePerfSection/
git commit -m "refactor(live-perf): co-locate component + new fetch-error unit test"
```

---

## Task 6: Footer folder — migrate test + new E2E

**Files:**
- Move: `components/sections/Footer.client.tsx` → `components/sections/Footer/Footer.client.tsx`
- Move: `components/sections/Footer.module.css` → `components/sections/Footer/Footer.module.css`
- Create: `components/sections/Footer/index.ts`
- Create: `components/sections/Footer/Footer.test.tsx`
- Create: `components/sections/Footer/Footer.e2e.ts`
- Delete: `__tests__/footer-lazy.test.ts`

Note: `FooterLazy.client.tsx` stays at `components/sections/FooterLazy.client.tsx` — it's a thin lazy-loader with no independent test needed. The Footer test covers the observable contract of the lazy-loading mechanism.

- [ ] **Step 1: Create folder and move files**

```bash
mkdir components/sections/Footer
git mv components/sections/Footer.client.tsx components/sections/Footer/Footer.client.tsx
git mv components/sections/Footer.module.css components/sections/Footer/Footer.module.css
```

- [ ] **Step 2: Create barrel export**

```ts
// components/sections/Footer/index.ts
export { Footer } from './Footer.client';
```

- [ ] **Step 3: Migrate unit test — update FooterLazy import path**

Copy full content of `__tests__/footer-lazy.test.ts` into `components/sections/Footer/Footer.test.tsx`. Update one import:

```ts
// Change:
await import('@/components/sections/FooterLazy.client')
// To:
await import('../FooterLazy.client')
```

Also update the mountClient helper import:
```ts
// Change:
import { mountClient } from './helpers/render';
// To:
import { mountClient } from '@/tests/mocks/../../../__tests__/helpers/render';
// Simpler: keep using @/ alias — the helper is at __tests__/helpers/render.ts
import { mountClient } from '@/__tests__/helpers/render';
```

- [ ] **Step 4: Run test**

```bash
pnpm test -- --reporter=verbose components/sections/Footer
```

Expected: 3 tests pass.

- [ ] **Step 5: Delete source file**

```bash
git rm __tests__/footer-lazy.test.ts
```

- [ ] **Step 6: Create Footer E2E**

```ts
// components/sections/Footer/Footer.e2e.ts
import { expect, test } from '@playwright/test';

test.describe('Footer — links and content', () => {
  test('GitHub link has correct href', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    const github = footer.getByRole('link', { name: /github/i });
    await expect(github).toHaveAttribute('href', 'https://github.com/erikunha');
  });

  test('LinkedIn link has correct href', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    const linkedin = footer.getByRole('link', { name: /linkedin/i });
    await expect(linkedin).toHaveAttribute('href', 'https://www.linkedin.com/in/erikunha/');
  });

  test('footer is present in the DOM', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer')).toBeAttached();
  });
});
```

- [ ] **Step 7: Run full suite**

```bash
pnpm test
```

Expected: 286 tests pass.

- [ ] **Step 8: Commit**

```bash
git add components/sections/Footer/
git commit -m "refactor(footer): co-locate component, CSS, unit test, E2E in Footer/ folder"
```

---

## Task 7: Simple client migrations — HeroBootAnimation, HeroSystemFailure, RoleTyper

**Files per component:**
- Move: `ComponentName.tsx` → `ComponentName/ComponentName.tsx`
- Create: `ComponentName/index.ts`
- Create: `ComponentName/ComponentName.test.tsx`
- Delete: `__tests__/<original-test>.test.ts`

**Important:** `boot-animation-no-usestate.test.ts` imports `@/components/sections/Hero.module.css` directly. After Hero moved to `sections/Hero/Hero.module.css`, this import path must change to `@/components/sections/Hero/Hero.module.css`.

- [ ] **Step 1: Create HeroBootAnimation folder**

```bash
mkdir components/client/HeroBootAnimation
git mv components/client/HeroBootAnimation.tsx components/client/HeroBootAnimation/HeroBootAnimation.tsx
```

Create barrel:
```ts
// components/client/HeroBootAnimation/index.ts
export { HeroBootAnimation } from './HeroBootAnimation';
```

- [ ] **Step 2: Migrate HeroBootAnimation test**

Copy `__tests__/boot-animation-no-usestate.test.ts` → `components/client/HeroBootAnimation/HeroBootAnimation.test.tsx`.

Update the CSS import (Hero moved to a subfolder):
```ts
// Change:
import styles from '@/components/sections/Hero.module.css';
// To:
import styles from '@/components/sections/Hero/Hero.module.css';
```

Update the render helper import:
```ts
// Change:
import { mountClient } from './helpers/render';
// To:
import { mountClient } from '@/__tests__/helpers/render';
```

- [ ] **Step 3: Run HeroBootAnimation tests**

```bash
pnpm test -- --reporter=verbose components/client/HeroBootAnimation
```

Expected: all boot-animation tests pass.

- [ ] **Step 4: Delete source**

```bash
git rm __tests__/boot-animation-no-usestate.test.ts
```

- [ ] **Step 5: Create HeroSystemFailure folder**

```bash
mkdir components/client/HeroSystemFailure
git mv components/client/HeroSystemFailure.tsx components/client/HeroSystemFailure/HeroSystemFailure.tsx
```

Create barrel:
```ts
// components/client/HeroSystemFailure/index.ts
export { HeroSystemFailure } from './HeroSystemFailure';
```

- [ ] **Step 6: Migrate HeroSystemFailure test**

Copy `__tests__/sysfail-loop.test.ts` → `components/client/HeroSystemFailure/HeroSystemFailure.test.tsx`.

Update imports:
```ts
// Change any @/components/client/HeroSystemFailure imports to:
import { HeroSystemFailure } from './HeroSystemFailure';
// Update mountClient helper:
import { mountClient } from '@/__tests__/helpers/render';
```

- [ ] **Step 7: Run HeroSystemFailure tests**

```bash
pnpm test -- --reporter=verbose components/client/HeroSystemFailure
```

Expected: all sysfail tests pass.

- [ ] **Step 8: Delete source**

```bash
git rm __tests__/sysfail-loop.test.ts
```

- [ ] **Step 9: Create RoleTyper folder**

```bash
mkdir components/client/RoleTyper
git mv components/client/RoleTyper.tsx components/client/RoleTyper/RoleTyper.tsx
```

Create barrel:
```ts
// components/client/RoleTyper/index.ts
export { RoleTyper } from './RoleTyper';
```

- [ ] **Step 10: Migrate RoleTyper test**

Copy `__tests__/roletyper-a11y.test.ts` → `components/client/RoleTyper/RoleTyper.test.tsx`.

Update imports:
```ts
// Change any @/components/client/RoleTyper imports to:
import { RoleTyper } from './RoleTyper';
// Update mountClient helper:
import { mountClient } from '@/__tests__/helpers/render';
```

- [ ] **Step 11: Run RoleTyper tests**

```bash
pnpm test -- --reporter=verbose components/client/RoleTyper
```

Expected: all roletyper a11y tests pass.

- [ ] **Step 12: Delete source and run full suite**

```bash
git rm __tests__/roletyper-a11y.test.ts
pnpm test
```

Expected: 286 tests pass.

- [ ] **Step 13: Commit**

```bash
git add components/client/HeroBootAnimation/ components/client/HeroSystemFailure/ components/client/RoleTyper/
git commit -m "refactor(client): co-locate HeroBootAnimation, HeroSystemFailure, RoleTyper with unit tests"
```

---

## Task 8: ContactForm folder — merge 4 tests + move E2E

**Files:**
- Move: `components/client/ContactForm.tsx` → `components/client/ContactForm/ContactForm.tsx`
- Move: `components/client/ContactForm.module.css` → `components/client/ContactForm/ContactForm.module.css`
- Create: `components/client/ContactForm/index.ts`
- Create: `components/client/ContactForm/ContactForm.test.tsx` (merge 4 → 1)
- Move: `tests/e2e/contact.spec.ts` → `components/client/ContactForm/ContactForm.e2e.ts`
- Delete: 4 `__tests__/` files

- [ ] **Step 1: Create folder and move files**

```bash
mkdir components/client/ContactForm
git mv components/client/ContactForm.tsx components/client/ContactForm/ContactForm.tsx
git mv components/client/ContactForm.module.css components/client/ContactForm/ContactForm.module.css
```

Create barrel:
```ts
// components/client/ContactForm/index.ts
export { ContactForm } from './ContactForm';
```

- [ ] **Step 2: Create merged unit test**

Create `components/client/ContactForm/ContactForm.test.tsx` by concatenating the four source files (`contact-form-a11y.test.ts`, `contact-honeypot.test.ts`, `contact-rate-limit.test.ts`, `focus-and-error.test.ts`) into one file. Rules for the merge:

- One top-level `import` block (deduplicate identical imports)
- Each file's `describe` block stays intact as a named block inside the merged file
- Replace any `@/components/client/ContactForm` imports with `./ContactForm`
- Replace any `@/components/client/ContactForm.module.css` imports with `./ContactForm.module.css`
- Replace any `import { mountClient } from './helpers/render'` with `import { mountClient } from '@/__tests__/helpers/render'`

- [ ] **Step 3: Run merged unit tests**

```bash
pnpm test -- --reporter=verbose components/client/ContactForm
```

Expected: all contact form tests pass (previously split across 4 files — count should be equal).

- [ ] **Step 4: Delete 4 source files**

```bash
git rm __tests__/contact-form-a11y.test.ts \
       __tests__/contact-honeypot.test.ts \
       __tests__/contact-rate-limit.test.ts \
       __tests__/focus-and-error.test.ts
```

- [ ] **Step 5: Move E2E spec**

```bash
git mv tests/e2e/contact.spec.ts components/client/ContactForm/ContactForm.e2e.ts
```

Update the `_helpers` import path (was relative to `tests/e2e/`):
```ts
// Change:
import { installMockBackend } from './_helpers/mock-backend';
// To:
import { installMockBackend } from '../../../tests/e2e/_helpers/mock-backend';
```

- [ ] **Step 6: Update Playwright testMatch to exclude the moved file**

In `playwright.config.ts`, the existing `chromium-mobile`, `webkit-desktop`, `webkit-mobile` projects use:
```ts
testMatch: /tests\/e2e\/(contact|ask|visual|cross-cutting|design-system-components)\.spec\.ts$/,
```

Remove `contact` from the alternation since that spec is now in `components/` and picked up by the new `*-components` projects:
```ts
testMatch: /tests\/e2e\/(ask|visual|cross-cutting|design-system-components)\.spec\.ts$/,
```

- [ ] **Step 7: Run full suite**

```bash
pnpm test
```

Expected: 286 tests pass.

- [ ] **Step 8: Commit**

```bash
git add components/client/ContactForm/ playwright.config.ts
git commit -m "refactor(contact-form): co-locate component, merged unit tests, E2E in ContactForm/ folder"
```

---

## Task 9: InteractiveShell folder — merge 2 tests + move E2E

**Files:**
- Move: `components/client/InteractiveShell.tsx` → `components/client/InteractiveShell/InteractiveShell.tsx`
- Move: `components/client/InteractiveShell.module.css` → `components/client/InteractiveShell/InteractiveShell.module.css`
- Create: `components/client/InteractiveShell/index.ts`
- Create: `components/client/InteractiveShell/InteractiveShell.test.tsx` (merge 2 → 1)
- Move: `tests/e2e/ask.spec.ts` → `components/client/InteractiveShell/InteractiveShell.e2e.ts`
- Delete: 2 `__tests__/` files

- [ ] **Step 1: Create folder and move files**

```bash
mkdir components/client/InteractiveShell
git mv components/client/InteractiveShell.tsx components/client/InteractiveShell/InteractiveShell.tsx
git mv components/client/InteractiveShell.module.css components/client/InteractiveShell/InteractiveShell.module.css
```

Create barrel:
```ts
// components/client/InteractiveShell/index.ts
export { InteractiveShell } from './InteractiveShell';
```

- [ ] **Step 2: Create merged unit test**

Create `components/client/InteractiveShell/InteractiveShell.test.tsx` by merging `__tests__/InteractiveShell.streaming.test.ts` and `__tests__/shell-aria.test.ts`. Rules:

- One import block (deduplicate)
- Each file's `describe` block stays intact
- Replace `@/components/client/InteractiveShell` imports with `./InteractiveShell`
- Replace `@/components/client/InteractiveShell.module.css` with `./InteractiveShell.module.css`
- Replace `import { mountClient } from './helpers/render'` with `import { mountClient } from '@/__tests__/helpers/render'`

- [ ] **Step 3: Run merged unit tests**

```bash
pnpm test -- --reporter=verbose components/client/InteractiveShell
```

Expected: all streaming + aria tests pass.

- [ ] **Step 4: Delete source files**

```bash
git rm __tests__/InteractiveShell.streaming.test.ts __tests__/shell-aria.test.ts
```

- [ ] **Step 5: Move E2E spec**

```bash
git mv tests/e2e/ask.spec.ts components/client/InteractiveShell/InteractiveShell.e2e.ts
```

Update helper imports:
```ts
// Change any ./_helpers/* paths to:
import { ... } from '../../../tests/e2e/_helpers/<file>';
```

- [ ] **Step 6: Update Playwright testMatch — remove `ask`**

```ts
// In playwright.config.ts, chromium-mobile / webkit-desktop / webkit-mobile:
testMatch: /tests\/e2e\/(visual|cross-cutting|design-system-components)\.spec\.ts$/,
```

- [ ] **Step 7: Run full suite**

```bash
pnpm test
```

Expected: 286 tests pass.

- [ ] **Step 8: Commit**

```bash
git add components/client/InteractiveShell/ playwright.config.ts
git commit -m "refactor(shell): co-locate component, merged unit tests, E2E in InteractiveShell/ folder"
```

---

## Task 10: ToTopButton folder + new E2E

**Files:**
- Move: `components/client/ToTopButton.tsx` → `components/client/ToTopButton/ToTopButton.tsx`
- Move: `components/client/ToTopButton.module.css` → `components/client/ToTopButton/ToTopButton.module.css`
- Create: `components/client/ToTopButton/index.ts`
- Create: `components/client/ToTopButton/ToTopButton.e2e.ts`

- [ ] **Step 1: Create folder and move files**

```bash
mkdir components/client/ToTopButton
git mv components/client/ToTopButton.tsx components/client/ToTopButton/ToTopButton.tsx
git mv components/client/ToTopButton.module.css components/client/ToTopButton/ToTopButton.module.css
```

Create barrel:
```ts
// components/client/ToTopButton/index.ts
export { ToTopButton } from './ToTopButton';
```

- [ ] **Step 2: Create E2E spec**

```ts
// components/client/ToTopButton/ToTopButton.e2e.ts
import { expect, test } from '@playwright/test';

test.describe('ToTopButton — scroll-to-top affordance', () => {
  test('button is hidden on initial load (page top)', async ({ page }) => {
    await page.goto('/');
    // ToTopButton only appears after scrolling past the threshold.
    // On initial load it should not be visible.
    const btn = page.getByRole('button', { name: /top/i });
    await expect(btn).not.toBeVisible();
  });

  test('button appears after scrolling down the page', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(300);
    const btn = page.getByRole('button', { name: /top/i });
    await expect(btn).toBeVisible();
  });

  test('clicking the button scrolls back to the top', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(300);
    const btn = page.getByRole('button', { name: /top/i });
    await btn.click();
    await page.waitForTimeout(500);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });
});
```

- [ ] **Step 3: Run full unit suite**

```bash
pnpm test
```

Expected: 286 tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/client/ToTopButton/
git commit -m "refactor(to-top): co-locate component, CSS, E2E in ToTopButton/ folder"
```

---

## Task 11: Responsive — MatrixRain migration + DesktopTopbar + Dock E2E

**Files:**
- Move: `components/responsive/MatrixRain.client.tsx` → `components/responsive/MatrixRain/MatrixRain.client.tsx`
- Create: `components/responsive/MatrixRain/index.ts`
- Create: `components/responsive/MatrixRain/MatrixRain.test.tsx`
- Create: `components/responsive/DesktopTopbar/DesktopTopbar.e2e.ts`
- Create: `components/responsive/Dock/Dock.e2e.ts`
- Delete: `__tests__/matrix-rain.test.ts`

Note: `DesktopTopbar.client.tsx` and `Dock.client.tsx` keep their existing flat structure — they have no CSS to co-locate (or minimal) and no unit tests. Only E2E is added.

- [ ] **Step 1: Create MatrixRain folder**

```bash
mkdir components/responsive/MatrixRain
git mv components/responsive/MatrixRain.client.tsx components/responsive/MatrixRain/MatrixRain.client.tsx
```

Create barrel:
```ts
// components/responsive/MatrixRain/index.ts
export { MatrixRain } from './MatrixRain.client';
```

- [ ] **Step 2: Migrate MatrixRain test**

Copy `__tests__/matrix-rain.test.ts` → `components/responsive/MatrixRain/MatrixRain.test.tsx`.

Update imports:
```ts
// Change any @/components/responsive/MatrixRain.client imports to:
import { MatrixRain } from './MatrixRain.client';
// Update mountClient helper:
import { mountClient } from '@/__tests__/helpers/render';
```

- [ ] **Step 3: Run MatrixRain tests**

```bash
pnpm test -- --reporter=verbose components/responsive/MatrixRain
```

Expected: all matrix-rain tests pass.

- [ ] **Step 4: Delete source file**

```bash
git rm __tests__/matrix-rain.test.ts
```

- [ ] **Step 5: Create DesktopTopbar E2E**

```ts
// components/responsive/DesktopTopbar/DesktopTopbar.e2e.ts
import { expect, test } from '@playwright/test';

test.describe('DesktopTopbar — navigation', () => {
  test('topbar is visible on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    const topbar = page.getByRole('navigation').first();
    await expect(topbar).toBeVisible();
  });

  test('design system link navigates to /design-system', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    const dsLink = page.getByRole('link', { name: /design.?system/i });
    await dsLink.click();
    await expect(page).toHaveURL('/design-system');
  });

  test('topbar links are keyboard-focusable', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    const firstLink = page.getByRole('navigation').getByRole('link').first();
    await firstLink.focus();
    await expect(firstLink).toBeFocused();
  });
});
```

- [ ] **Step 6: Create Dock E2E**

```ts
// components/responsive/Dock/Dock.e2e.ts
import { expect, test } from '@playwright/test';

test.describe('Dock — mobile navigation', () => {
  test('dock is visible on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const dock = page.getByRole('navigation', { name: /dock/i });
    await expect(dock).toBeVisible();
  });

  test('dock items are tappable links', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const dock = page.getByRole('navigation', { name: /dock/i });
    const links = dock.getByRole('link');
    await expect(links.first()).toBeVisible();
  });

  test('design system dock item navigates to /design-system', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const dsLink = page.getByRole('link', { name: /design.?system/i });
    await dsLink.click();
    await expect(page).toHaveURL('/design-system');
  });
});
```

- [ ] **Step 7: Run full suite**

```bash
pnpm test
```

Expected: 286 tests pass.

- [ ] **Step 8: Commit**

```bash
git add components/responsive/MatrixRain/ components/responsive/DesktopTopbar/ components/responsive/Dock/
git commit -m "refactor(responsive): co-locate MatrixRain unit test; add DesktopTopbar + Dock E2E"
```

---

## Task 12: CopyButton (DS docs) — new E2E

**Files:**
- Move: `app/design-system/_components/CopyButton.client.tsx` → `app/design-system/_components/CopyButton/CopyButton.client.tsx`
- Move: `app/design-system/_components/CopyButton.module.css` → `app/design-system/_components/CopyButton/CopyButton.module.css`
- Create: `app/design-system/_components/CopyButton/index.ts`
- Create: `app/design-system/_components/CopyButton/CopyButton.e2e.ts`

- [ ] **Step 1: Create folder and move files**

```bash
mkdir app/design-system/_components/CopyButton
git mv app/design-system/_components/CopyButton.client.tsx app/design-system/_components/CopyButton/CopyButton.client.tsx
git mv app/design-system/_components/CopyButton.module.css app/design-system/_components/CopyButton/CopyButton.module.css
```

Create barrel:
```ts
// app/design-system/_components/CopyButton/index.ts
export { CopyButton } from './CopyButton.client';
```

Check `Preview.tsx` — it imports CopyButton. If using `'./CopyButton.client'`, update to `'./CopyButton'` (resolves to the new index.ts). If using an absolute `@/` path, no change needed.

- [ ] **Step 2: Create E2E spec**

```ts
// app/design-system/_components/CopyButton/CopyButton.e2e.ts
import { expect, test } from '@playwright/test';

test.describe('CopyButton — clipboard interaction', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('clicking copy button copies code to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/design-system/components');
    const firstCopyBtn = page.getByRole('button', { name: /copy/i }).first();
    await firstCopyBtn.click();
    const clipText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipText.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run full suite**

```bash
pnpm test
```

Expected: 286 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/design-system/_components/CopyButton/
git commit -m "refactor(copy-button): co-locate DS doc component + clipboard E2E"
```

---

## Task 13: Final verification

- [ ] **Step 1: Run full unit suite**

```bash
pnpm test
```

Expected: 286 tests pass. If count differs, investigate — some tests may have been accidentally duplicated or lost.

- [ ] **Step 2: Run full CI gate**

```bash
pnpm ci:local
```

Expected: lint + typecheck + validate-content + client-naming + dep-pinning all pass.

- [ ] **Step 3: Verify no broken imports**

```bash
pnpm typecheck
```

Expected: 0 errors. Any error points to an import that wasn't updated after a file move.

- [ ] **Step 4: Verify Vitest coverage now includes design-system**

```bash
pnpm test -- --coverage
```

Check the coverage report — `design-system/components/**` should now appear in the summary table.

- [ ] **Step 5: Confirm __tests__/ no longer contains migrated files**

```bash
ls __tests__/ | sort
```

Expected: only non-component-owned tests remain (ask-*, api-*, browser-rum, budget-cap, content-visibility, csp-report, css-paint-cost, erik-json, lighthouse-fallback, log-structured, matrix-rain if not moved, motion, proxy-csp, redis-singleton, route-handler, section-mobile-variants, section-viewport-variants, skip-to-content, system-prompt, ua, scripts/).

- [ ] **Step 6: Commit any final cleanup**

```bash
git add -A
git commit -m "chore(test): final cleanup after component module structure migration"
```
