// __tests__/use-breakpoint.test.tsx
// Behavioral tests for BreakpointProvider + useBreakpoint.
// Locks down: provider renders children; hook returns the provided isMobile value;
// hook throws when called outside the provider.

import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, mountClient } from '@/__tests__/helpers/render';
import { BreakpointProvider, useBreakpoint } from '@/lib/use-breakpoint.client';

// jsdom does not implement window.matchMedia — stub it.
function stubMatchMedia(matches: boolean) {
  const listeners: (() => void)[] = [];
  const mql = {
    matches,
    addEventListener: (_: string, cb: () => void) => listeners.push(cb),
    removeEventListener: (_: string, cb: () => void) => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    },
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql),
  );
  return mql;
}

describe('BreakpointProvider', () => {
  beforeEach(() => {
    stubMatchMedia(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders children without throwing', async () => {
    const { container, unmount } = await mountClient(
      createElement(
        BreakpointProvider,
        { initialIsMobile: false },
        createElement('span', { 'data-testid': 'child' }, 'inner'),
      ),
    );
    expect(container.querySelector('[data-testid="child"]')).not.toBeNull();
    unmount();
  });

  it('provides isMobile=false when initialIsMobile is false', async () => {
    let captured: { isMobile: boolean } | undefined;

    function Consumer() {
      captured = useBreakpoint();
      return createElement('span', null, null);
    }

    const { unmount } = await mountClient(
      createElement(BreakpointProvider, { initialIsMobile: false }, createElement(Consumer)),
    );
    await flushMicrotasks();

    expect(captured?.isMobile).toBe(false);
    unmount();
  });

  it('provides isMobile=true when initialIsMobile is true and matchMedia reports mobile', async () => {
    stubMatchMedia(true);
    let captured: { isMobile: boolean } | undefined;

    function Consumer() {
      captured = useBreakpoint();
      return createElement('span', null, null);
    }

    const { unmount } = await mountClient(
      createElement(BreakpointProvider, { initialIsMobile: true }, createElement(Consumer)),
    );
    await flushMicrotasks();

    expect(captured?.isMobile).toBe(true);
    unmount();
  });
});

describe('useBreakpoint — outside provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when called outside <BreakpointProvider>', async () => {
    // Suppress React's console.error for the expected uncaught render error.
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op to suppress React render error noise
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let thrownMessage = '';

    function ThrowingConsumer() {
      // Hook at top-level of component — valid per Rules of Hooks.
      // Context is null (no provider), so this throws synchronously.
      const ctx = useBreakpoint();
      return createElement('span', null, String(ctx.isMobile));
    }

    try {
      await mountClient(createElement(ThrowingConsumer));
    } catch (e) {
      thrownMessage = e instanceof Error ? e.message : String(e);
    }

    consoleSpy.mockRestore();
    expect(thrownMessage).toContain('useBreakpoint must be used inside');
  });
});
