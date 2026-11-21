import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--font-mock', className: 'mock' }),
}));

const SURFACE_TOKEN = 'surface';
const SENTINEL = '#123456';
const TOKENS_MODULE = '@/app/(en)/design-system/_lib/theme-tokens';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock(TOKENS_MODULE);
});

describe('viewport theme color source', () => {
  it('takes the theme color from the surface token resolved out of theme.css', async () => {
    vi.doMock(TOKENS_MODULE, () => ({
      getThemeColors: () => ({ [SURFACE_TOKEN]: SENTINEL }),
    }));
    const { viewport } = await import('@/app/(en)/layout');
    expect(viewport.themeColor).toBe(SENTINEL);
  });

  it('resolves to a real hex from theme.css when nothing is mocked', async () => {
    const { viewport } = await import('@/app/(pt)/layout');
    expect(viewport.themeColor).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
