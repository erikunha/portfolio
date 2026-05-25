#!/usr/bin/env tsx
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

// Usage: pnpm generate:og
// Requires: dev server running on http://localhost:3000 (pnpm dev)
// Output: public/og.png (1200x630 PNG)

async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.goto('http://localhost:3000/opengraph-image', {
      waitUntil: 'networkidle',
      timeout: 10000,
    });
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    const outputPath = path.resolve(process.cwd(), 'public/og.png');
    writeFileSync(outputPath, buffer);
    console.log(`OG image saved to ${outputPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
