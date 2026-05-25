#!/usr/bin/env tsx
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Browser } from 'playwright';
import { chromium } from 'playwright';

// Usage: pnpm generate:og
// Requires: a dev server on http://localhost:3000 (pnpm dev) serving a route that renders the OG design.
// The original /opengraph-image route was deleted in fix/og-link-preview. To regenerate og.png, first
// add a new route at a non-convention URL (e.g. /og-preview) that renders the desired design, then
// update the URL below before running this script.
// Output: public/og.png (1200x630 PNG)

async function main() {
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 630 });
    const response = await page.goto('http://localhost:3000/opengraph-image', {
      waitUntil: 'networkidle',
      timeout: 10000,
    });
    if (!response || response.status() !== 200) {
      throw new Error(
        `/opengraph-image returned ${response?.status() ?? 'no response'} — route must exist to generate OG image`,
      );
    }
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    const outputPath = path.resolve(process.cwd(), 'public/og.png');
    writeFileSync(outputPath, buffer);
    console.log(`OG image saved to ${outputPath}`);
  } finally {
    await browser?.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
