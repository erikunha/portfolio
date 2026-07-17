# SEO & Accessibility Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Superseded where noted — DECISIONS.md (2026-07-13) and the shipped code are authoritative.** The code samples below are the *pre-implementation* plan; review refined two details: (1) the design-system `openGraph`/`twitter` metadata is FULLY re-specified per route — `og:image` is KEPT (the branded `/og.png`), not dropped, because Next's shallow metadata merge would otherwise silently drop siteName/locale/image and leave subpages inheriting the homepage's twitter card; (2) the page-nav JSON-LD uses a plain `<script>{JSON.stringify(...)}</script>` child (matching `app/layout.tsx`), not `dangerouslySetInnerHTML`. Where a sample differs from the shipped `dsPageMetadata`, the code + DECISIONS.md govern. **The page-nav trail this plan built was removed on 2026-07-16 (see DECISIONS.md); its tasks are dropped from this plan and the remaining five units are what shipped and survive.**

**Goal:** Fix the `/design-system/*` canonical-to-homepage bug, collapse the duplicate hero `<h1>`, add screen-reader/crawler-readable topic labels to the terminal section headings, and make `/design-system` discoverable — one PR on branch `feat/seo-improvements`.

**Architecture:** Metadata correctness via a small pure helper the MDX pages import; a single `sr-only` `<h1>` + `aria-hidden` visible variants for the hero; an optional `srLabel` sr-only span on the shared `Module` `<h2>` fed by a Zod-validated content map; and a footer internal link.

**Tech Stack:** Next.js 16 App Router (RSC default), TypeScript strict, Tailwind v4, Vitest, MDX metadata exports, zod.

## Global Constraints

- RSC by default. **No new client island.** Any new page-level UI MUST be server-rendered from per-page data — NO `usePathname`/`useSelectedLayoutSegment`/`use client` (adds an island, spends app-owned client JS).
- Homepage `metadata.description` ≤ 160 chars AND must contain the exact substring `Senior Full-Stack Engineer` (the `__tests__/identity-consistency.test.ts` gate). Do NOT change `metadata.title` (pinned by `og-metadata` + identity tests).
- All new user-facing copy (section labels) lives in `content/*.ts`, Zod-validated at module load — never inlined in `.tsx`. (The existing inline visible headers are pre-existing and NOT migrated here.)
- Canonical/og:url use RELATIVE paths resolved against the root `metadataBase` (`https://erikunha.dev`) — never duplicate absolute URLs.
- The helper re-specifies the FULL `openGraph` + `twitter` per route (type/locale/url/title/description/siteName + the branded `/og.png`, and a per-route twitter card) — Next merges metadata shallowly, so setting `openGraph`/`twitter` REPLACES the root's and any field not restated is silently dropped. (An earlier draft dropped `og:image` as an owner-settled "text docs" simplification; reversed in `aa4b2e6` — see DECISIONS.md.)
- `sr-only` is the existing clip-based utility in `app/css/base.css` (crawlable; not `display:none`). Use it; do not create a new one.
- No dependency added. Every unit independently revertible.
- Visual baselines: hero change is expected pixel-identical (INSPECT before commit; regen only on a real diff). Footer change is expected to alter the footer baseline (regen darwin+linux per `.claude/skills/visual-baseline-regen`).
- Final review battery MUST include `accessibility-tester` + `performance-engineer` (heading/aria + Lighthouse-SEO/a11y surface).
- Dropped from the original spec (YAGNI, stated in the PR body): the sitemap `lastmod` change (already per-group; distinct per-page dates would be fabricated) and the separate contextual in-content link (no natural anchor; footer + topbar cover internal linking).

---

## Unit 1 — Metadata correctness

### Task 1: `dsPageMetadata` helper + per-route canonical/og:url on the 5 MDX pages

**Files:**
- Create: `app/design-system/_lib/page-metadata.ts`
- Create: `app/design-system/_lib/page-metadata.test.ts`
- Modify: `app/design-system/page.mdx:1-4`, `app/design-system/tokens/page.mdx:1-4`, `app/design-system/components/page.mdx:1-4`, `app/design-system/enforcement/page.mdx:1-4`, `app/design-system/changelog/page.mdx:1-4`

**Interfaces:**
- Produces: `dsPageMetadata({ slug, title, description }: { slug: string; title: string; description: string }): Metadata` — `slug: ''` → path `/design-system`; `slug: 'tokens'` → `/design-system/tokens`. Sets `alternates.canonical` and `openGraph.url` to that relative path, plus `title`, `description`, `openGraph.{title,description,type:'website'}`.

- [ ] **Step 1: Write the failing test** — `app/design-system/_lib/page-metadata.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { dsPageMetadata } from './page-metadata';

describe('dsPageMetadata', () => {
  it('sets a self-referential relative canonical for a subpage', () => {
    const m = dsPageMetadata({ slug: 'tokens', title: 'T', description: 'D' });
    expect(m.alternates?.canonical).toBe('/design-system/tokens');
    // og:url must match the canonical path so search + social agree
    expect((m.openGraph as { url?: string }).url).toBe('/design-system/tokens');
  });

  it('maps the empty slug to the section root', () => {
    const m = dsPageMetadata({ slug: '', title: 'T', description: 'D' });
    expect(m.alternates?.canonical).toBe('/design-system');
    expect((m.openGraph as { url?: string }).url).toBe('/design-system');
  });

  it('passes title and description through to both the page and openGraph', () => {
    const m = dsPageMetadata({ slug: 'components', title: 'Comps', description: 'Nine primitives' });
    expect(m.title).toBe('Comps');
    expect(m.description).toBe('Nine primitives');
    expect((m.openGraph as { title?: string }).title).toBe('Comps');
    expect((m.openGraph as { description?: string }).description).toBe('Nine primitives');
  });

  it('does not emit an absolute URL (resolves against metadataBase)', () => {
    const m = dsPageMetadata({ slug: 'tokens', title: 'T', description: 'D' });
    expect(String(m.alternates?.canonical)).not.toMatch(/^https?:/);
    expect(String((m.openGraph as { url?: string }).url)).not.toMatch(/^https?:/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run app/design-system/_lib/page-metadata.test.ts`
Expected: FAIL — `Cannot find module './page-metadata'`.

- [ ] **Step 3: Write minimal implementation** — `app/design-system/_lib/page-metadata.ts`

```ts
import type { Metadata } from 'next';

// Per-route self-canonical for the design-system subtree. The root layout sets an ABSOLUTE
// alternates.canonical = https://erikunha.dev; Next.js inherits it into every child that does not
// override it, so all 5 subpages self-report the homepage as canonical (a real dedup bug). Setting
// a RELATIVE canonical here resolves against the root metadataBase. og:url is set to the same path
// so social and search agree. Note: setting openGraph replaces (not merges) the parent's openGraph,
// so the inherited og:image is intentionally dropped for these text pages (owner-settled).
export function dsPageMetadata({
  slug,
  title,
  description,
}: {
  slug: string;
  title: string;
  description: string;
}): Metadata {
  const path = slug === '' ? '/design-system' : `/design-system/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: 'website' },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run app/design-system/_lib/page-metadata.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Apply to the 5 MDX pages.** Replace the top `export const metadata = {...}` block in each, preserving the existing `title`/`description` strings verbatim. Example for `app/design-system/tokens/page.mdx` (current lines 1-4):

```mdx
import { dsPageMetadata } from '../_lib/page-metadata';

export const metadata = dsPageMetadata({
  slug: 'tokens',
  title: 'Tokens — Design System — erikunha.dev',
  description: 'Brand colour from @theme, plus the Tailwind scale used for type, spacing, motion, and layers',
});
```

Apply the same shape to the other four, with the correct import depth and slug:
- `app/design-system/page.mdx` → `import { dsPageMetadata } from './_lib/page-metadata';`, `slug: ''`
- `app/design-system/components/page.mdx` → `import ... from '../_lib/page-metadata';`, `slug: 'components'`
- `app/design-system/enforcement/page.mdx` → `slug: 'enforcement'`
- `app/design-system/changelog/page.mdx` → `slug: 'changelog'`
- Copy each file's EXISTING `title` and `description` strings unchanged.

- [ ] **Step 6: Verify the build resolves MDX → helper and canonical renders.**

Run: `pnpm build 2>&1 | grep -E 'design-system|error|Error' | head`
Expected: build succeeds; the 5 design-system routes compile. Then confirm the rendered canonical (optional local check): `pnpm start` and `curl -s localhost:3000/design-system/tokens | grep -o '<link rel="canonical"[^>]*>'` → should contain `href="https://erikunha.dev/design-system/tokens"`.

- [ ] **Step 7: Commit**

```bash
git add app/design-system/_lib/page-metadata.ts app/design-system/_lib/page-metadata.test.ts app/design-system/page.mdx app/design-system/tokens/page.mdx app/design-system/components/page.mdx app/design-system/enforcement/page.mdx app/design-system/changelog/page.mdx
git commit -m "fix(seo): self-referential canonical + og:url per design-system route"
```

### Task 2: Trim the homepage meta description

**Files:**
- Modify: `app/layout.tsx:29-30`
- Test: `__tests__/identity-consistency.test.ts` (extend) OR a new `__tests__/meta-description.test.ts`

**Interfaces:**
- Consumes: `metadata` export from `app/layout.tsx`.

- [ ] **Step 1: Write the failing test** — new file `__tests__/meta-description.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { metadata } from '@/app/layout';

describe('homepage meta description', () => {
  it('is <= 160 chars so Google does not truncate before the value terms', () => {
    const desc = String(metadata.description ?? '');
    expect(desc.length).toBeLessThanOrEqual(160);
    expect(desc.length).toBeGreaterThan(0);
  });

  it('retains the identity-gated substring', () => {
    expect(String(metadata.description)).toContain('Senior Full-Stack Engineer');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run __tests__/meta-description.test.ts`
Expected: FAIL on the length assertion (current description is 212 chars).

- [ ] **Step 3: Implement — replace the description string** at `app/layout.tsx:29-30` with this exact 150-char string:

```
Senior Full-Stack Engineer — React, Next.js, Angular, TypeScript, Node.js. Frontend architecture, platform & applied-AI engineering for high-traffic apps.
```

(Only the `description:` field on the root `metadata` object. Leave `title`, `openGraph`, `twitter`, `alternates` unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test --run __tests__/meta-description.test.ts __tests__/identity-consistency.test.ts __tests__/og-metadata.test.ts`
Expected: PASS (the identity + og tests must stay green — the title/og image are untouched).

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx __tests__/meta-description.test.ts
git commit -m "fix(seo): trim homepage meta description to 150 chars, front-load the stack"
```

---

## Unit 2 — Semantic headings

### Task 3: Collapse the hero to a single `<h1>` (sr-only) with aria-hidden visible variants

**Files:**
- Modify: `components/sections/Hero/Hero.tsx:19-24` (desktop) and `:74-79` (mobile)
- Modify: `components/sections/Hero/Hero.test.tsx:25-61`

**Interfaces:**
- Consumes: existing `sr-only` class (`app/css/base.css`), existing `data-testid="hero-name"`.

- [ ] **Step 1: Update the failing tests first** — `components/sections/Hero/Hero.test.tsx`. Replace the three heading assertions (lines 20-41 and 57-61) with:

```tsx
  it('renders exactly one semantic h1 with the name', () => {
    const html = renderHero();
    const h1Count = (html.match(/<h1/g) ?? []).length;
    expect(h1Count).toBe(1);
    expect(html).toMatch(/<h1[^>]*class="[^"]*sr-only[^"]*"[^>]*>Erik Cunha<\/h1>/);
  });

  it('renders the visible name in each variant as an aria-hidden non-heading', () => {
    const doc = new DOMParser().parseFromString(renderHero(), 'text/html');
    const desktop = doc.querySelector(`.${desktopClass} .${bioClass} [data-testid="hero-name"]`);
    const mobile = doc.querySelector(`.${mobileClass} [data-testid="hero-name"]`);
    expect(desktop).not.toBeNull();
    expect(mobile).not.toBeNull();
    expect(desktop?.tagName.toLowerCase()).not.toBe('h1');
    expect(mobile?.tagName.toLowerCase()).not.toBe('h1');
    expect(desktop?.getAttribute('aria-hidden')).toBe('true');
    expect(mobile?.getAttribute('aria-hidden')).toBe('true');
  });
```

(Keep the existing `renderHero`, `desktopClass`, `mobileClass`, `bioClass` constants at the top of the file.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test --run components/sections/Hero/Hero.test.tsx`
Expected: FAIL — currently 2 h1s, no sr-only h1, visible names are `<h1>` not aria-hidden.

- [ ] **Step 3: Implement** in `components/sections/Hero/Hero.tsx`:

(a) Add one sr-only h1 as the FIRST child of the returned fragment (before the `hero-desktop` section):

```tsx
      <h1 className="sr-only">Erik Cunha</h1>
```

(b) Change the desktop name (lines 19-24) from `<h1 ...>` to `<p ...>` with `aria-hidden`, keeping the className identical:

```tsx
          <p
            className="font-mono font-bold text-[32px] md:text-[48px] text-primary-500 m-0 mb-1 leading-[1.2]"
            data-testid="hero-name"
            aria-hidden="true"
          >
            Erik Cunha
          </p>
```

(c) Change the mobile name (lines 74-79) the same way, className identical:

```tsx
          <p
            className="font-mono font-bold text-[24px] text-primary-500 border-t border-dashed border-primary-quiet pt-3.5 mt-1.5 mb-0.5 leading-[1.55]"
            data-testid="hero-name"
            aria-hidden="true"
          >
            Erik Cunha
          </p>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test --run components/sections/Hero/Hero.test.tsx`
Expected: PASS.

- [ ] **Step 5: Visual parity check (MANDATORY before commit).** Run `pnpm build && DEPLOY_SALT=test pnpm start &`, then via Playwright MCP screenshot the hero at desktop 1280×720 and mobile 375×812. Compare against the current live hero. Expected: pixel-identical (a `<p>` with the same explicit classes renders identically; the sr-only h1 is `position:absolute;clip`).
  - If identical: no baseline regen needed.
  - If any real diff: regen the hero baseline in `tests/visual/visual.spec.ts` (darwin + linux) per `.claude/skills/visual-baseline-regen`, inspect the PNGs, commit them with this task.

- [ ] **Step 6: Commit**

```bash
git add components/sections/Hero/Hero.tsx components/sections/Hero/Hero.test.tsx
git commit -m "fix(a11y): single sr-only h1 in hero; visible names become aria-hidden"
```

### Task 4: `srLabel` on `Module` + Zod-validated `SECTION_LABELS` + fail-closed guard

**Files:**
- Create: `content/section-labels.ts`
- Create: `content/section-labels.test.ts`
- Modify: `components/responsive/Module/Module.tsx:4-12` (props) and `:45-59` (h2)
- Modify: every `components/sections/*/[Name].tsx` that renders `<Module>` — add `srLabel={SECTION_LABELS['<id>']}`
- Create: `components/responsive/Module/Module.srlabel.test.tsx`

**Interfaces:**
- Produces: `SECTION_LABELS: Readonly<Record<string, string>>` keyed by each section's `Module` `id`.
- Produces: `Module` gains optional prop `srLabel?: string`.

- [ ] **Step 1: Write the content file and its validation test.** `content/section-labels.ts`:

```ts
import { z } from 'zod';

// Plain-English topic per section, exposed to screen readers and crawlers as an sr-only span inside
// the terminal-styled <h2> (whose visible text is a shell command like "LS -LA ./PROJECTS"). Keyed
// by the section's Module id. Content discipline: labels live here, Zod-validated, never inlined.
export const SECTION_LABELS = {
  'sec-readme': 'About',
  'sec-shell': 'Interactive shell',
  'sec-ai-metrics': 'AI answer-quality evaluation',
  'sec-projects': 'Projects',
  'sec-perf-receipts': 'Performance receipts',
  'sec-responsibilities': 'Responsibilities',
  'sec-now': 'Now',
  'sec-npm-stack': 'Tech stack',
  'sec-career': 'Career history',
  'sec-manpage': 'Profile manual',
  'sec-live-perf': 'Live performance',
  'sec-sys-health': 'System health',
  'sec-credentials': 'Credentials',
  'sec-visa': 'Work authorization',
  'sec-community': 'Community',
  'sec-hottest-takes': 'Opinions',
  'sec-guitar': 'Guitar rig',
  'sec-daw-mixer': 'DAW mixer',
  'sec-unknowns': 'Open questions',
  'sec-contact': 'Contact',
} as const;

z.record(z.string(), z.string().min(1)).parse(SECTION_LABELS);
```

> **Implementer note (finalize the keys against the code):** the id strings above are the expected `Module` `id` values, but you MUST confirm each against the actual section `.tsx` (`grep -rn 'id="sec' components/sections`). If a real id differs, correct the key. The guard test in Step 5 fails closed if any rendered section id lacks a label, so no section can silently miss one.

`content/section-labels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SECTION_LABELS } from './section-labels';

describe('SECTION_LABELS', () => {
  it('every label is a non-empty plain-English string (not a shell command)', () => {
    for (const [id, label] of Object.entries(SECTION_LABELS)) {
      expect(label.length, id).toBeGreaterThan(0);
      expect(label, id).not.toMatch(/[/~]|--|\.\w/); // no path/flag/extension shell syntax
    }
  });
});
```

- [ ] **Step 2: Run it** — `pnpm test --run content/section-labels.test.ts` → PASS (pure data).

- [ ] **Step 3: Write the failing Module test** — `components/responsive/Module/Module.srlabel.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Module } from './Module';

describe('Module srLabel', () => {
  it('renders the srLabel as an sr-only span inside the h2 when provided', () => {
    const { container } = render(
      <Module id="sec-x" header="LS -LA ./X" srLabel="Projects">
        <div />
      </Module>,
    );
    const h2 = container.querySelector('h2');
    const sr = h2?.querySelector('span.sr-only');
    expect(sr?.textContent).toBe('Projects');
  });

  it('omits the sr-only span when no srLabel is given', () => {
    const { container } = render(
      <Module id="sec-y" header="LS -LA ./Y">
        <div />
      </Module>,
    );
    expect(container.querySelector('h2 span.sr-only')).toBeNull();
  });
});
```

- [ ] **Step 4: Run to verify it fails** — `pnpm test --run components/responsive/Module/Module.srlabel.test.tsx` → FAIL (no `srLabel` prop).

- [ ] **Step 5: Implement the Module change.**
(a) Props type (`components/responsive/Module/Module.tsx:4-12`): add `srLabel?: string;`.
(b) In the `<h2>` (after line 46 `id=...`, as the FIRST child before the icon span at line 49), insert:

```tsx
          {srLabel ? <span className="sr-only">{srLabel}</span> : null}
```

- [ ] **Step 6: Run the Module test** → PASS.

- [ ] **Step 7: Wire `srLabel` into every section.** For each `components/sections/*/[Name].tsx` that renders `<Module id="...">`, import `SECTION_LABELS` from `@/content/section-labels` and add `srLabel={SECTION_LABELS['<that id>']}`. Example (`ContactSection.tsx`):

```tsx
import { SECTION_LABELS } from '@/content/section-labels';
// ...
    <Module
      id="sec-contact"
      header="SUDO CONTACT --INIT"
      mobileHeader="CONTACT"
      srLabel={SECTION_LABELS['sec-contact']}
      icon={<IconContact />}
      defer={defer}
      variant="green"
    >
```

- [ ] **Step 8: Write the fail-closed coverage guard.** Append to `content/section-labels.test.ts` a test that renders the full page and asserts every `Module` `<h2>` has an sr-only label. Simplest robust form — assert every section id used in the app is a key:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

it('every section that renders a Module has a SECTION_LABELS entry (fail-closed)', () => {
  const dir = join(process.cwd(), 'components/sections');
  const ids = new Set<string>();
  for (const entry of readdirSync(dir)) {
    const file = join(dir, entry, `${entry}.tsx`);
    let src = '';
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!/<Module\b/.test(src)) continue;
    const m = src.match(/id="(sec-[^"]+)"/);
    if (m) ids.add(m[1]);
  }
  for (const id of ids) {
    expect(SECTION_LABELS, `missing label for ${id}`).toHaveProperty(id);
  }
  expect(ids.size).toBeGreaterThanOrEqual(18);
});
```

> This test reads source files; it needs a `// behavioral-test-allow: enumerates section ids to prove label coverage` tag at the top per the `no-source-grep` gate. Add that tag.

- [ ] **Step 9: Run the full unit-2 tests + typecheck.**

Run: `pnpm test --run content/section-labels.test.ts components/responsive/Module && pnpm typecheck`
Expected: PASS. If the guard fails, add the missing `SECTION_LABELS` key (a real section was missed).

- [ ] **Step 10: Commit**

```bash
git add content/section-labels.ts content/section-labels.test.ts components/responsive/Module/Module.tsx components/responsive/Module/Module.srlabel.test.tsx components/sections/
git commit -m "feat(a11y): sr-only topic labels on terminal section headings"
```

---

## Unit 3 — Discoverability

### Task 5: Footer internal link to `/design-system`

**Files:**
- Modify: `components/sections/Footer/Footer.client.tsx` (both NETSTAT variants: mobile-grid ~231-270 and desktop `<pre>` ~271-311)
- Create: `components/sections/Footer/Footer.designsystem-link.test.tsx`

- [ ] **Step 1: Write the failing test:**

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Footer } from './Footer.client';

describe('Footer design-system link', () => {
  it('links to /design-system as a same-site internal link (no target=_blank)', () => {
    const { container } = render(<Footer />);
    const links = [...container.querySelectorAll('a[href="/design-system"]')];
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      expect(a.getAttribute('target')).not.toBe('_blank');
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL (no such link).

- [ ] **Step 3: Implement.** In each NETSTAT variant, add an internal link styled like the existing `netstat-link` entries but WITHOUT `target="_blank"`/`rel`. Match the surrounding markup shape of the sibling links; use label `~/design_system` and `href="/design-system"`. (Read the exact sibling `<a>` structure in each variant and mirror it, swapping the href/label and dropping the external-link attributes.)

- [ ] **Step 4: Run the test** → PASS. Also run the existing Footer tests: `pnpm test --run components/sections/Footer`.

- [ ] **Step 5: Visual baseline.** The footer is a captured section. Run the Playwright MCP visual check (desktop + mobile), then regen the footer baseline in `tests/visual/visual.spec.ts` (darwin + linux) per `.claude/skills/visual-baseline-regen`; inspect the PNGs before committing.

- [ ] **Step 6: Commit**

```bash
git add components/sections/Footer/Footer.client.tsx components/sections/Footer/Footer.designsystem-link.test.tsx tests/visual/
git commit -m "feat(seo): footer internal link to /design-system (mobile-reachable)"
```

## Final verification (before opening the PR)

- [ ] `pnpm ci:local` passes (lint + type + content + client-naming + harness-size + tests).
- [ ] `pnpm build` succeeds; confirm NO new `*.client.tsx` was introduced — `check-client-naming` stays green.
- [ ] `pnpm bundle-check` — client-JS budget unchanged (no island added).
- [ ] Runtime gates: `pnpm gates:runtime` (build + LHCI desktop/mobile + axe + e2e) — Lighthouse SEO=100, A11y=100 must hold.
- [ ] Visual baselines committed for any section that actually changed (footer expected; hero only if a real diff appeared).
- [ ] Run the 5-agent review battery, MUST include `accessibility-tester` + `performance-engineer` (heading/aria + Lighthouse-SEO/a11y surface), plus `code-reviewer`, `security-auditor`, `dependency-manager`.
- [ ] PR body: fill the template; note the single-PR scope is intentional (three cohesive units), and that the sitemap-lastmod and separate contextual-link items from the original audit were dropped (with reasons).

## Failure-mode checklist (thinking-inversion — each is covered by a task/test above)

1. Next.js `openGraph`/`twitter` child-replace silently drops any field not restated (siteName/locale/image, the whole twitter card) → helper re-specifies the FULL og + twitter per route incl the branded `/og.png`; Task 1 (refined in `aa4b2e6`, see DECISIONS.md).
2. sr-only `srLabel` garbles the accessible name → Task 4 test asserts the sr-only span text; axe gate in final verification.
3. Hero `<h1>`→`<p>` visual drift → Task 3 Step 5 inspect-before-commit + baseline.
4. Footer link with `target="_blank"` → Task 5 test asserts no `_blank`.
5. Description trim drops the identity substring → Task 2 test asserts length AND substring; identity gate re-run.
6. `SECTION_LABELS` missing a section id → Task 4 Step 8 fail-closed guard.
