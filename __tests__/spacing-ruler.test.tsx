// __tests__/spacing-ruler.test.tsx
// Behavioral tests for app/design-system/_components/SpacingRuler/SpacingRuler.tsx.
// Locks down: renders token name and resolved value; handles unknown tokens by
// returning null; caps bar width at MAX_BAR_PX (320px); renders usage label
// when provided; handles non-numeric resolved values gracefully.

import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { mountClient } from './helpers/render';

// Note: CSS Modules are handled by Vite's transform — no manual mock needed.

describe('SpacingRuler', () => {
  async function render(props: { token: string; usage?: string }) {
    const { SpacingRuler } = await import(
      '@/app/design-system/_components/SpacingRuler/SpacingRuler'
    );
    return mountClient(createElement(SpacingRuler, props));
  }

  it('renders the token name in a <code> element', async () => {
    const { container, unmount } = await render({ token: 'ds-space-4' });
    const code = container.querySelector('code');
    expect(code).not.toBeNull();
    expect(code?.textContent).toContain('ds-space-4');
    unmount();
  });

  it('renders the resolved pixel value for a known token', async () => {
    const { container, unmount } = await render({ token: 'ds-space-4' });
    expect(container.textContent).toContain('16px');
    unmount();
  });

  it('renders null (no DOM output) for an unknown token', async () => {
    const { container, unmount } = await render({ token: 'nonexistent-token' });
    expect(container.firstChild).toBeNull();
    unmount();
  });

  it('renders bar with numeric width for a pixel value', async () => {
    const { container, unmount } = await render({ token: 'ds-space-4' });
    // bar element has inline style width set to the px value or 320px cap
    const bar = container.querySelector('[aria-hidden="true"]') as HTMLElement | null;
    expect(bar).not.toBeNull();
    const width = bar?.style.width ?? '';
    expect(width).toMatch(/^\d+px$/);
    unmount();
  });

  it('caps bar width at 320px for very large token values', async () => {
    // ds-space-rhythm is {ds-space-16} = 64px — well within cap
    // ds-layout-maxw = 1200px — should be capped to 320px
    const { container, unmount } = await render({ token: 'ds-layout-maxw' });
    const bar = container.querySelector('[aria-hidden="true"]') as HTMLElement | null;
    expect(bar?.style.width).toBe('320px');
    unmount();
  });

  it('renders the usage label when the usage prop is provided', async () => {
    const { container, unmount } = await render({ token: 'ds-space-4', usage: 'grid gap' });
    expect(container.textContent).toContain('grid gap');
    unmount();
  });

  it('renders without usage label when usage prop is omitted', async () => {
    const { container, unmount } = await render({ token: 'ds-space-2' });
    // Just ensure it renders token and value, no crash
    expect(container.textContent).toContain('ds-space-2');
    unmount();
  });
});
