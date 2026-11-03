import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('BrandSchema', () => {
  it('accepts the shipped brand', async () => {
    const { brand } = await import('./brand');
    const { BrandSchema } = await import('./schemas');

    expect(BrandSchema.parse(brand)).toEqual({
      homeHref: '/',
      accessibleName: 'erikunha.dev, home',
    });
  });

  it.each(['homeHref', 'accessibleName'])('rejects an empty %s', async (field) => {
    const { BrandSchema } = await import('./schemas');
    const valid = { homeHref: '/', accessibleName: 'erikunha.dev, home' };

    expect(
      BrandSchema.safeParse({ ...valid, [field]: '' }).success,
      `brand.${field} must be non-empty: the brand link is an icon with no visible text, so an empty accessible name leaves the home link unnamed`,
    ).toBe(false);
  });
});

describe('build-time content gate', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('rejects a brand with an empty accessible name', async () => {
    vi.doMock('./brand', () => ({ brand: { homeHref: '/', accessibleName: '' } }));

    await expect(
      import('./_validate-client-content'),
      'the build gate must parse brand: it is read by client components, so content/brand.ts carries no runtime parse of its own and an unparsed schema fails open',
    ).rejects.toThrow();
  });
  it('rejects a world map whose land grid has the wrong row count', async () => {
    vi.doUnmock('./terminal-chrome');
    const actual = await vi.importActual<typeof import('./world-map')>('./world-map');
    vi.doMock('./world-map', () => ({
      ...actual,
      worldMap: { ...actual.worldMap, land: actual.worldMap.land.slice(1) },
    }));

    await expect(
      import('./_validate-client-content'),
      'the build gate must parse worldMap: content/world-map.ts is imported by the client island, so it carries no runtime parse of its own and an unparsed schema fails open',
    ).rejects.toThrow();
  });
});
