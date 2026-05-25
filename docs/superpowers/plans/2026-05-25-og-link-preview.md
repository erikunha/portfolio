# OG Link Preview Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix link previews on WhatsApp, LinkedIn, Slack, Discord, and Twitter/X by replacing the broken dynamic Edge-generated OG image with a committed static PNG and adding explicit `images` fields to the metadata.

**Architecture:** Write a failing regression test first, then fix the metadata to make it pass. Separately, generate `public/og.png` by Playwright-screenshotting the existing Edge function design in dev mode, then delete the Edge function.

**Tech Stack:** Next.js 15 App Router metadata API, Playwright (chromium), tsx, Vitest

---

### Task 1: Write failing regression test for OG metadata

**Files:**
- Create: `__tests__/og-metadata.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// __tests__/og-metadata.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--font-mock', className: 'mock' }),
}));

describe('layout metadata og:image', () => {
  it('openGraph.images is a non-empty array with url, width, and height', async () => {
    const { metadata } = await import('@/app/layout');
    const og = metadata.openGraph as Record<string, unknown>;
    const images = og.images as { url: string; width: number; height: number; alt: string }[];
    expect(Array.isArray(images)).toBe(true);
    expect(images.length).toBeGreaterThan(0);
    expect(images[0].url).toBe('/og.png');
    expect(images[0].width).toBe(1200);
    expect(images[0].height).toBe(630);
  });

  it('twitter.images is a non-empty array pointing to /og.png', async () => {
    const { metadata } = await import('@/app/layout');
    const tw = metadata.twitter as Record<string, unknown>;
    const images = tw.images as string[];
    expect(Array.isArray(images)).toBe(true);
    expect(images[0]).toBe('/og.png');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test --run __tests__/og-metadata.test.ts 2>&1 | tail -20
```

Expected: FAIL — `Cannot read properties of undefined (reading '0')` or `expected undefined to be an array`.

---

### Task 2: Add explicit images to layout.tsx metadata

**Files:**
- Modify: `app/layout.tsx` — `openGraph` and `twitter` blocks inside `export const metadata`

- [ ] **Step 1: Update openGraph in app/layout.tsx**

Find the `openGraph` block (around line 65) and replace it with:

```typescript
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://erikunha.dev',
    title: 'Erik Cunha — Staff Full-Stack Engineer · Applied AI',
    description:
      'Staff Full-Stack Engineer · Applied AI · 8+ yrs · LLM · RAG · Angular · React · Next.js · Node.js',
    siteName: 'erikunha.dev',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Erik Cunha — Staff Full-Stack Engineer · Applied AI',
      },
    ],
  },
```

- [ ] **Step 2: Update twitter in app/layout.tsx**

Find the `twitter` block and replace it with:

```typescript
  twitter: {
    card: 'summary_large_image',
    title: 'Erik Cunha — Staff Full-Stack Engineer · Applied AI',
    description:
      'Staff Full-Stack Engineer · Applied AI · Angular · React · Next.js · Node.js · TypeScript',
    images: ['/og.png'],
  },
```

- [ ] **Step 3: Run the test to confirm it passes**

```bash
pnpm test --run __tests__/og-metadata.test.ts 2>&1 | tail -10
```

Expected: PASS — 2 tests passing.

- [ ] **Step 4: Run typecheck to confirm no TS errors**

```bash
pnpm typecheck 2>&1 | grep -E 'error|Error' | head -10
```

Expected: no output (zero errors).

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx __tests__/og-metadata.test.ts
git commit -m "fix(seo): add explicit og:image and twitter:image to metadata"
```

---

### Task 3: Write the OG image generation script

**Files:**
- Create: `scripts/generate-og-image.ts`
- Modify: `package.json` — add `"generate:og"` script

- [ ] **Step 1: Create the script**

```typescript
#!/usr/bin/env tsx
// Usage: pnpm generate:og
// Requires: dev server running on http://localhost:3000 (pnpm dev)
// Output: public/og.png (1200x630 PNG)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto('http://localhost:3000/opengraph-image', { waitUntil: 'networkidle' });
  const buffer = await page.screenshot({ type: 'png', fullPage: false });
  const outputPath = path.resolve(process.cwd(), 'public/og.png');
  writeFileSync(outputPath, buffer);
  console.log(`OG image saved to ${outputPath}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add generate:og to package.json scripts**

In `package.json`, add this line to the `"scripts"` block (after `"validate-content"`):

```json
"generate:og": "tsx scripts/generate-og-image.ts",
```

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-og-image.ts package.json
git commit -m "chore(seo): add og image generation script"
```

---

### Task 4: Generate public/og.png

**Files:**
- Create: `public/og.png`

- [ ] **Step 1: Start the dev server in a separate terminal**

```bash
pnpm dev
```

Wait until you see `Ready in Xms` in the terminal output before continuing.

- [ ] **Step 2: Run the generation script**

In a second terminal (the dev server must stay running):

```bash
pnpm generate:og 2>&1
```

Expected output: `OG image saved to .../public/og.png`

- [ ] **Step 3: Verify the file was created at the correct dimensions**

```bash
file public/og.png
```

Expected: something like `public/og.png: PNG image data, 1200 x 630, ...`

- [ ] **Step 4: Open the image to visually confirm the design**

Open `public/og.png` in any image viewer. Confirm:
- Black background
- Lime green "ERIK CUNHA" heading
- "Staff Full-Stack Engineer · Applied AI" subtitle
- Tech stack row at the bottom
- CRT scanline overlay visible

If the image looks blank or wrong, check if the dev server is running and navigate to `http://localhost:3000/opengraph-image` in a browser to debug the Edge function.

- [ ] **Step 5: Stop the dev server** (Ctrl+C in its terminal)

- [ ] **Step 6: Commit the generated PNG**

```bash
git add public/og.png
git commit -m "feat(seo): add static og.png (1200x630) for link previews"
```

---

### Task 5: Delete the Edge function

**Files:**
- Delete: `app/opengraph-image.tsx`

- [ ] **Step 1: Remove the file**

```bash
git rm app/opengraph-image.tsx
```

- [ ] **Step 2: Run typecheck and tests to confirm nothing broke**

```bash
pnpm typecheck 2>&1 | grep -E 'error|Error' | head -5
pnpm test --run 2>&1 | tail -10
```

Expected: zero TS errors, all tests passing.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(seo): remove dynamic opengraph-image edge function"
```

---

### Task 6: Run full CI gate

- [ ] **Step 1: Run ci:local**

```bash
pnpm ci:local 2>&1 | tail -15
```

Expected: all checks pass (lint, typecheck, content validate, client-naming, harness-size, tests).

- [ ] **Step 2: Fix any failures before continuing**

If any check fails, fix it and re-run `pnpm ci:local` before moving to the next step.

- [ ] **Step 3: Verify the og.png is accessible**

```bash
ls -lh public/og.png
```

Expected: file exists, size between 50KB–500KB (a 1200×630 PNG of this design is typically ~100–200KB).

---

## Post-deploy verification checklist

After deploying to production, check each platform:

| Platform | How to verify |
|---|---|
| WhatsApp | Share `https://erikunha.dev` in a chat — preview should appear with image |
| LinkedIn | Use Post Inspector: `https://www.linkedin.com/post-inspector/` |
| Slack | Paste `https://erikunha.dev` in a DM to yourself |
| Discord | Paste the URL in any channel |
| Twitter/X | Card Validator: `https://cards-dev.twitter.com/validator` |
| General | `https://metatags.io/?url=https://erikunha.dev` |

**WhatsApp cache note:** If a device previously shared the URL, it may show a blank/broken preview for up to 72 hours. New shares from devices that haven't shared the URL before will show the updated preview immediately.
