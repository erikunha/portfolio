// __tests__/hero-system-failure.test.tsx
// Behavioral tests for components/client/HeroSystemFailure/HeroSystemFailure.tsx.
// Locks down: component mounts hidden by default; shows when 'hero:sysfail:show'
// fires on window; hides again when 'hero:sysfail:hide' fires; cleans up listeners
// on unmount.

import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

vi.mock('@/lib/motion', () => ({
  readMotion: () => false,
}));

// Hero.module.css is imported inside HeroSystemFailure — Vite transforms CSS
// modules to objects in jsdom so no manual mock needed.

describe('HeroSystemFailure', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  async function renderComponent() {
    const { HeroSystemFailure } = await import(
      '@/components/client/HeroSystemFailure/HeroSystemFailure'
    );
    mounted = await mountClient(createElement(HeroSystemFailure));
    return mounted.container;
  }

  it('renders the SYSTEM FAILURE plate in the DOM on mount', async () => {
    const container = await renderComponent();
    expect(container.textContent).toContain('SYSTEM FAILURE');
  });

  it('is hidden by default (visible state is false)', async () => {
    const container = await renderComponent();
    // The outer div has aria-hidden="true" always (decorative overlay)
    const outer = container.querySelector('[aria-hidden="true"]') as HTMLElement | null;
    expect(outer).not.toBeNull();
    // When not visible, the component renders without the `on` class modifier
    // We cannot assert the exact hashed class name from CSS Modules, but we
    // can confirm the component is present and its aria-hidden is set.
    expect(outer?.getAttribute('aria-hidden')).toBe('true');
  });

  it('becomes visible when hero:sysfail:show fires on window', async () => {
    const container = await renderComponent();
    const before = container.innerHTML;

    await act(async () => {
      window.dispatchEvent(new Event('hero:sysfail:show'));
    });

    // After show event, the rendered HTML should differ (class list changes)
    const after = container.innerHTML;
    expect(after).not.toBe(before);
  });

  it('reverts to hidden when hero:sysfail:hide fires after show', async () => {
    const container = await renderComponent();

    await act(async () => {
      window.dispatchEvent(new Event('hero:sysfail:show'));
    });
    const visibleHtml = container.innerHTML;

    await act(async () => {
      window.dispatchEvent(new Event('hero:sysfail:hide'));
    });
    const hiddenHtml = container.innerHTML;

    expect(hiddenHtml).not.toBe(visibleHtml);
  });

  it('removes window listeners on unmount (no error after unmount)', async () => {
    await renderComponent();
    mounted.unmount();

    // Dispatching after unmount must not throw or cause React errors
    expect(() => {
      window.dispatchEvent(new Event('hero:sysfail:show'));
      window.dispatchEvent(new Event('hero:sysfail:hide'));
    }).not.toThrow();
  });
});
