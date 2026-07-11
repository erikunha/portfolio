import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

vi.mock('@/lib/use-breakpoint.client', () => ({
  useBreakpoint: () => ({ isMobile: false }),
  BreakpointProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/lib/motion', () => ({
  readMotion: () => false,
  applyMotion: () => undefined,
}));

describe('skip-to-content link', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  async function renderAppShell(): Promise<HTMLElement> {
    const { AppShell } = await import('@/components/AppShell');
    mounted = await mountClient(
      createElement(AppShell, null, createElement('main', { id: 'main-content' }, 'content')),
    );
    return mounted.container;
  }

  it('AppShell renders a skip link targeting the main landmark', async () => {
    const container = await renderAppShell();

    const skip = container.querySelector<HTMLAnchorElement>('a.skip-to-content');
    expect(skip).not.toBeNull();
    expect(skip?.getAttribute('href')).toBe('#main-content');
    expect(skip?.textContent ?? '').toMatch(/skip to (main )?content/i);
  });

  it('the skip link is the first link in the document (lands first on Tab)', async () => {
    const container = await renderAppShell();

    const firstLink = container.querySelector('a');
    expect(firstLink?.classList.contains('skip-to-content')).toBe(true);
  });
});
