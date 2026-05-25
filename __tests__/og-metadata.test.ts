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
