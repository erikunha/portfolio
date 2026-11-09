#!/usr/bin/env tsx
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Browser } from 'playwright';
import { chromium } from 'playwright';

import {
  BRAND_ICON_PATH,
  BRAND_ICON_SOURCE_SIZE,
  BRAND_ICON_SOURCE_VIEWBOX,
} from '../design-system/components/BrandIcon/brand-icon-path';

const SIGNAL_GREEN = '#00FF41';
const BACKGROUND = '#000000';
const PATH_CENTER_X = 2153.5;
const PATH_CENTER_Y = 2083;
const GLYPH_SCALE = 0.9;
const PNG_OUTPUTS = [
  { file: 'public/favicon-16x16.png', size: 16 },
  { file: 'public/favicon-32x32.png', size: 32 },
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/android-chrome-192x192.png', size: 192 },
  { file: 'public/android-chrome-512x512.png', size: 512 },
] as const;
const ICO_SIZES = [16, 32] as const;
const ICO_HEADER_BYTES = 6;
const ICO_ENTRY_BYTES = 16;

function iconSvg(): string {
  const half = BRAND_ICON_SOURCE_SIZE / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_ICON_SOURCE_VIEWBOX}"><rect width="${BRAND_ICON_SOURCE_SIZE}" height="${BRAND_ICON_SOURCE_SIZE}" fill="${BACKGROUND}"/><path fill="${SIGNAL_GREEN}" transform="translate(${half} ${half}) scale(${GLYPH_SCALE}) translate(${-PATH_CENTER_X} ${-PATH_CENTER_Y})" d="${BRAND_ICON_PATH}"/></svg>\n`;
}

function buildIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(ICO_HEADER_BYTES);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = ICO_HEADER_BYTES + ICO_ENTRY_BYTES * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(ICO_ENTRY_BYTES);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

async function render(browser: Browser, svg: string, size: number): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<html><body style="margin:0;background:${BACKGROUND}"><div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div></body></html>`,
  );
  const png = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: size, height: size },
  });
  await page.close();
  return png;
}

async function main() {
  const svg = iconSvg();
  writeFileSync(path.resolve(process.cwd(), 'app/icon.svg'), svg);
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    const bySize = new Map<number, Buffer>();
    for (const { file, size } of PNG_OUTPUTS) {
      const png = await render(browser, svg, size);
      bySize.set(size, png);
      writeFileSync(path.resolve(process.cwd(), file), png);
      console.log(`${file} (${png.length} bytes)`);
    }
    const ico = buildIco(
      ICO_SIZES.map((size) => ({ size, png: bySize.get(size) ?? Buffer.alloc(0) })),
    );
    writeFileSync(path.resolve(process.cwd(), 'public/favicon.ico'), ico);
    console.log(`public/favicon.ico (${ico.length} bytes)`);
  } finally {
    await browser?.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
