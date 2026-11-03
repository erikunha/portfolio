// behavioral-test-allow: the artifacts under test ARE the generated icon files.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--font-mock', className: 'mock' }),
}));

import { BRAND_ICON_PATH } from '@/design-system/components/BrandIcon/brand-icon-path';

const ROOT = process.cwd();
const PNG_WIDTH_OFFSET = 16;
const PNG_HEIGHT_OFFSET = 20;
const PNG_ICONS = [
  { file: 'public/favicon-16x16.png', size: 16 },
  { file: 'public/favicon-32x32.png', size: 32 },
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/android-chrome-192x192.png', size: 192 },
  { file: 'public/android-chrome-512x512.png', size: 512 },
];

describe('brand icon assets', () => {
  it.each(PNG_ICONS)('$file is $size px square', ({ file, size }) => {
    const png = readFileSync(path.join(ROOT, file));
    expect(png.readUInt32BE(PNG_WIDTH_OFFSET)).toBe(size);
    expect(png.readUInt32BE(PNG_HEIGHT_OFFSET)).toBe(size);
  });

  it('app/icon.svg draws the brand path in the signal colour on black', () => {
    // behavioral-test-allow: the generated icon file is the artifact under test
    const svg = readFileSync(path.join(ROOT, 'app/icon.svg'), 'utf8');
    expect(svg).toContain(BRAND_ICON_PATH);
    expect(svg).toContain('#00FF41');
    expect(svg).toContain('fill="#000000"');
  });

  it('the web manifest names the 192 and 512 icons on a black theme', () => {
    // behavioral-test-allow: the manifest file is the artifact under test
    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'public/site.webmanifest'), 'utf8'));
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual([
      '192x192',
      '512x512',
    ]);
    expect(manifest.theme_color).toBe('#000000');
    expect(manifest.background_color).toBe('#000000');
  });

  it('the root layout links the manifest', async () => {
    const { metadata } = await import('@/app/layout');
    expect(metadata.manifest).toBe('/site.webmanifest');
  });
});
