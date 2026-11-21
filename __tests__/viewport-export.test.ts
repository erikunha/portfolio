import { describe, expect, it, vi } from 'vitest';
import { getThemeColors } from '../app/(en)/design-system/_lib/theme-tokens';

vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--font-mock', className: 'mock' }),
}));

const SURFACE_TOKEN = 'surface';
const COLOR_SCHEME_DARK = 'dark';

const LAYOUTS = {
  en: () => import('@/app/(en)/layout'),
  pt: () => import('@/app/(pt)/layout'),
} as const;

describe('root layouts export viewport', () => {
  for (const [locale, load] of Object.entries(LAYOUTS)) {
    it(`the ${locale} layout sets the theme color to the surface token and a dark color scheme`, async () => {
      const layout = await load();
      const surface = getThemeColors()[SURFACE_TOKEN];
      expect(surface, 'the surface token must resolve to a hex color').toMatch(/^#[0-9a-f]{6}$/i);
      expect(layout.viewport.themeColor, 'browser chrome must match the page surface').toBe(
        surface,
      );
      expect(layout.viewport.colorScheme).toBe(COLOR_SCHEME_DARK);
    });
  }

  it('does not also declare the legacy themeColor inside metadata', async () => {
    const { metadata } = await import('@/app/(en)/layout');
    expect(metadata).not.toHaveProperty('themeColor');
  });
});
