// __tests__/color-swatch.test.tsx
// Behavioral tests for app/design-system/_components/ColorSwatch/ColorSwatch.tsx.
// ColorSwatch reads the @theme palette from app/css/theme.css (single source).
// Locks down: renders --color-<token> name and resolved value; null for unknown
// tokens; renders usage label when provided.

import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

describe('ColorSwatch', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render(props: { token: string; usage?: string }) {
    const { ColorSwatch } = await import('@/app/design-system/_components/ColorSwatch/ColorSwatch');
    mounted = await mountClient(createElement(ColorSwatch, props));
    return mounted.container;
  }

  it('renders the --color-<token> name in a <code> element', async () => {
    const container = await render({ token: 'primary-500' });
    const code = container.querySelector('code');
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe('--color-primary-500');
  });

  it('renders the resolved color value from theme.css', async () => {
    const container = await render({ token: 'primary-500' });
    expect(container.textContent).toContain('#00ff41');
  });

  it('renders null for an unknown token', async () => {
    const container = await render({ token: 'does-not-exist' });
    expect(container.firstChild).toBeNull();
  });

  it('renders the usage label when provided', async () => {
    const container = await render({ token: 'primary-500', usage: 'signal accent' });
    expect(container.textContent).toContain('signal accent');
  });

  it('renders a color swatch div with background style set', async () => {
    const container = await render({ token: 'secondary-900' });
    const swatch = container.querySelector('[aria-hidden="true"]') as HTMLElement | null;
    expect(swatch).not.toBeNull();
    expect(swatch?.style.background).toBeTruthy();
  });
});
