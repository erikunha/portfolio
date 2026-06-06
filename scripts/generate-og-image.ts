#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Browser } from 'playwright';
import { chromium } from 'playwright';

// Usage: pnpm generate:og
// No dev server required — renders the OG design from inline HTML.
// Output: public/og.png (1200x630 PNG)

const fontsDir = path.resolve(process.cwd(), 'public/fonts');

function fontBase64(file: string): string {
  return readFileSync(path.join(fontsDir, file)).toString('base64');
}

function buildHtml(): string {
  const mono400 = fontBase64('jetbrains-mono-400.woff2');
  const mono700 = fontBase64('jetbrains-mono-700.woff2');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @font-face {
    font-family: 'JetBrains Mono';
    src: url('data:font/woff2;base64,${mono400}') format('woff2');
    font-weight: 400;
    font-style: normal;
  }
  @font-face {
    font-family: 'JetBrains Mono';
    src: url('data:font/woff2;base64,${mono700}') format('woff2');
    font-weight: 700;
    font-style: normal;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px;
    height: 630px;
    background: #000;
    color: #E6FFE6;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    overflow: hidden;
    position: relative;
  }
  body::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      rgba(0,0,0,0.12) 3px,
      rgba(0,0,0,0.12) 4px
    );
    pointer-events: none;
    z-index: 10;
  }
  .container {
    padding: 52px 80px 56px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .top { display: flex; flex-direction: column; gap: 8px; }
  .domain {
    font-size: 20px;
    font-weight: 400;
    color: #00FF41;
    letter-spacing: 0.1em;
    opacity: 0.65;
  }
  .name {
    font-size: 120px;
    font-weight: 700;
    color: #00FF41;
    letter-spacing: 0.04em;
    line-height: 1;
    text-shadow:
      0 0 30px rgba(0,255,65,0.5),
      0 0 60px rgba(0,255,65,0.2);
    margin-top: 4px;
  }
  .title {
    font-size: 44px;
    font-weight: 700;
    color: #E6FFE6;
    letter-spacing: 0.04em;
    margin-top: 10px;
    white-space: nowrap;
  }
  .subtitle {
    font-size: 26px;
    font-weight: 400;
    color: #E6FFE6;
    letter-spacing: 0.03em;
    opacity: 0.75;
    margin-top: 6px;
    white-space: nowrap;
  }
  .stack {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
  }
  .tag {
    font-size: 26px;
    font-weight: 700;
    color: #00FF41;
    border: 1.5px solid rgba(0,255,65,0.7);
    padding: 8px 20px;
    letter-spacing: 0.06em;
    text-shadow: 0 0 10px rgba(0,255,65,0.3);
  }
</style>
</head>
<body>
<div class="container">
  <div class="top">
    <div class="domain">erikunha.dev</div>
    <div class="name">ERIK CUNHA</div>
    <div class="title">Senior Full-Stack Engineer</div>
    <div class="subtitle">Frontend Architecture &bull; Platform &amp; AI Applied Engineering</div>
    <div class="subtitle" style="margin-top:4px;">UI/UX &bull; Accessibility &bull; Web Performance for High-Traffic Apps</div>
  </div>
  <div class="stack">
    <span class="tag">React</span>
    <span class="tag">Next.js</span>
    <span class="tag">Angular</span>
    <span class="tag">TypeScript</span>
    <span class="tag">Node.js</span>
    <span class="tag">AWS</span>
  </div>
</div>
</body>
</html>`;
}

async function main() {
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.setContent(buildHtml(), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    if (!buffer || buffer.length === 0) {
      throw new Error('Screenshot returned empty buffer');
    }
    const outputPath = path.resolve(process.cwd(), 'public/og.png');
    writeFileSync(outputPath, buffer);
    console.log(`OG image saved to ${outputPath} (${buffer.length} bytes)`);
  } finally {
    await browser?.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
