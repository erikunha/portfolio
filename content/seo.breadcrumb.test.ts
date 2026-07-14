import { describe, expect, it } from 'vitest';
import { breadcrumbSchema } from './seo';

describe('breadcrumbSchema', () => {
  it('builds a BreadcrumbList with 1-based positions and absolute item URLs on the canonical host', () => {
    const s = breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Design System', path: '/design-system' },
      { name: 'Tokens', path: '/design-system/tokens' },
    ]) as {
      '@type': string;
      itemListElement: { position: number; name: string; item: string }[];
    };
    expect(s['@type']).toBe('BreadcrumbList');
    expect(s.itemListElement.map((e) => e.position)).toEqual([1, 2, 3]);
    expect(s.itemListElement[2]?.item).toBe('https://www.erikunha.dev/design-system/tokens');
    expect(s.itemListElement[0]?.item).toBe('https://www.erikunha.dev/');
    for (const e of s.itemListElement) expect(e.item).toMatch(/^https:\/\/www\.erikunha\.dev/);
  });
});
