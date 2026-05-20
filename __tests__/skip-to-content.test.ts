// __tests__/skip-to-content.test.ts
// Behavioral test (CG3): renders the real AppShell and asserts the
// skip-to-content link exists, is the first focusable element, and points at
// the page's main landmark — instead of grepping AppShell/page source text.
//
// The contract: a keyboard user pressing Tab on page load lands on a visible
// "Skip to main content" link whose href targets #main-content, letting them
// bypass the nav/overlay chrome.
//
// The third half of this contract — that a <main id="main-content"> landmark
// actually exists in the composed page so the anchor resolves — is verified
// end-to-end against the real rendered route by tests/e2e/cross-cutting.spec.ts
// (test 1: it `waitForSelector('main#main-content')`, asserts the skip link's
// href is `#main-content`, then activates it and confirms focus moves into the
// landmark). Re-rendering Home() here is impractical: app/page.tsx is a
// `force-static` RSC with async section components renderToStaticMarkup cannot
// drive, and the previous attempt to cover it hand-walked the React element
// tree — exactly the structural source-coupling CG3 removes.

import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

// AppShell pulls in MatrixRain (canvas), CRT overlays and responsive bars —
// stub the breakpoint hook so it renders the desktop variant deterministically.
vi.mock('@/lib/use-breakpoint.client', () => ({
  useBreakpoint: () => ({ isMobile: false }),
  BreakpointProvider: ({ children }: { children: unknown }) => children,
}));

// The chrome components (DesktopTopbar etc.) read prefers-reduced-motion via
// lib/motion → window.matchMedia, which jsdom does not implement. Stub it so
// the full AppShell subtree commits without throwing.
vi.mock('@/lib/motion', () => ({
  readMotion: () => false,
  applyMotion: () => {},
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
    const { AppShell } = await import('@/components/AppShell.client');
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

    // The skip link must be the first anchor in DOM order so Shift-free Tab
    // from the address bar reaches it before any nav chrome.
    const firstLink = container.querySelector('a');
    expect(firstLink?.classList.contains('skip-to-content')).toBe(true);
  });
});
