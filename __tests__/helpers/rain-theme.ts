import { getThemeColors } from '../../app/(en)/design-system/_lib/theme-tokens';

const RAIN_TAIL_ALPHA = '0.1';

export const RAIN_TEST_HEAD = getThemeColors()['rain-head'] ?? '';
export const RAIN_TEST_TAIL = 'rgba(0,0,0,0.1)';

export function declareRainTheme(root: HTMLElement = document.documentElement): void {
  const colors = getThemeColors();
  root.style.setProperty('--color-rain-head', colors['rain-head'] ?? '');
  root.style.setProperty('--color-rain-body', colors['rain-body'] ?? '');
  root.style.setProperty('--color-secondary-950', colors['secondary-950'] ?? '');
  root.style.setProperty('--rain-tail-alpha', RAIN_TAIL_ALPHA);
}

export function clearRainTheme(root: HTMLElement = document.documentElement): void {
  root.removeAttribute('style');
}
