// __tests__/skip-to-content.test.ts
// Behavioral test (CG3): renders the real AppShell and asserts the
// skip-to-content link exists, is the first focusable element, and points at
// the page's main landmark — instead of grepping AppShell/page source text.
//
// The contract: a keyboard user pressing Tab on page load lands on a visible
// "Skip to main content" link whose href targets #main-content, letting them
// bypass the nav/overlay chrome.

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  let container: HTMLElement;
  let root: import('react-dom/client').Root;

  beforeEach(() => {
    vi.resetModules();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('AppShell renders a skip link targeting the main landmark', async () => {
    const { createElement } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { AppShell } = await import('@/components/AppShell.client');

    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(AppShell, {
          children: createElement('main', { id: 'main-content' }, 'content'),
        }),
      );
    });

    const skip = container.querySelector<HTMLAnchorElement>('a.skip-to-content');
    expect(skip).not.toBeNull();
    expect(skip?.getAttribute('href')).toBe('#main-content');
    expect(skip?.textContent ?? '').toMatch(/skip to (main )?content/i);
  });

  it('the skip link is the first link in the document (lands first on Tab)', async () => {
    const { createElement } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { AppShell } = await import('@/components/AppShell.client');

    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(AppShell, {
          children: createElement('main', { id: 'main-content' }, 'content'),
        }),
      );
    });

    // The skip link must be the first anchor in DOM order so Shift-free Tab
    // from the address bar reaches it before any nav chrome.
    const firstLink = container.querySelector('a');
    expect(firstLink?.classList.contains('skip-to-content')).toBe(true);
  });

  it('app/page.tsx provides the #main-content landmark the skip link targets', async () => {
    // Walk the real element tree Home() composes and find the <main> the skip
    // link's href resolves to. This proves the anchor target genuinely exists
    // in the page composition — not just in a test fixture.
    const { default: Home } = await import('@/app/page');
    const tree = Home();

    function findMainWithId(node: unknown): boolean {
      if (!node || typeof node !== 'object') return false;
      if (Array.isArray(node)) return node.some(findMainWithId);
      const el = node as { type?: unknown; props?: Record<string, unknown> };
      if (el.type === 'main' && el.props?.id === 'main-content') return true;
      if (el.props && 'children' in el.props) return findMainWithId(el.props.children);
      return false;
    }

    expect(findMainWithId(tree)).toBe(true);
  });
});
