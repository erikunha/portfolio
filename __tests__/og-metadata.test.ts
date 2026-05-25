import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--font-mock', className: 'mock' }),
}));

describe('layout metadata og:image', () => {
  it('metadataBase resolves relative og:image URLs to the canonical origin', async () => {
    const { metadata } = await import('@/app/layout');
    expect(metadata.metadataBase?.toString()).toBe('https://erikunha.dev/');
  });

  it('openGraph.images is a non-empty array with url, width, height, and alt', async () => {
    const { metadata } = await import('@/app/layout');
    const og = metadata.openGraph as Record<string, unknown>;
    const images = og.images as { url: string; width: number; height: number; alt: string }[];
    expect(Array.isArray(images)).toBe(true);
    expect(images.length).toBeGreaterThan(0);
    expect(images[0]?.url).toBe('/og.png');
    expect(images[0]?.width).toBe(1200);
    expect(images[0]?.height).toBe(630);
    expect(images[0]?.alt).toBe('Erik Cunha — Staff Full-Stack Engineer · Applied AI');
  });

  it('twitter.images is a non-empty array pointing to /og.png', async () => {
    const { metadata } = await import('@/app/layout');
    const tw = metadata.twitter as Record<string, unknown>;
    const images = tw.images as string[];
    expect(Array.isArray(images)).toBe(true);
    expect(images.length).toBeGreaterThan(0);
    expect(images[0]).toBe('/og.png');
  });
});
