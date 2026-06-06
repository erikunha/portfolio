// __tests__/desktop-topbar-motion.test.tsx
// Behavioral tests for DesktopTopbar toggleMotion (lines 18-20).

import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

describe('DesktopTopbar — toggleMotion', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  it('clicking the MOTION button toggles data-motion from on to off', async () => {
    vi.doMock('@/lib/motion', () => ({
      readMotion: () => true,
      applyMotion: vi.fn(),
    }));

    const { DesktopTopbar } = await import(
      '@/components/responsive/DesktopTopbar/DesktopTopbar.client'
    );

    mounted = await mountClient(createElement(DesktopTopbar));
    const container = mounted.container;

    const btn = container.querySelector('button[data-motion]');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('data-motion')).toBe('on');

    await act(async () => {
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(btn?.getAttribute('data-motion')).toBe('off');
  });

  it('clicking the MOTION button toggles data-motion from off to on', async () => {
    vi.doMock('@/lib/motion', () => ({
      readMotion: () => false,
      applyMotion: vi.fn(),
    }));

    const { DesktopTopbar } = await import(
      '@/components/responsive/DesktopTopbar/DesktopTopbar.client'
    );

    mounted = await mountClient(createElement(DesktopTopbar));
    const container = mounted.container;

    const btn = container.querySelector('button[data-motion]');
    expect(btn?.getAttribute('data-motion')).toBe('off');

    await act(async () => {
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(btn?.getAttribute('data-motion')).toBe('on');
  });

  it('calls applyMotion with the new state on toggle', async () => {
    const applyMotionMock = vi.fn();
    vi.doMock('@/lib/motion', () => ({
      readMotion: () => true,
      applyMotion: applyMotionMock,
    }));

    const { DesktopTopbar } = await import(
      '@/components/responsive/DesktopTopbar/DesktopTopbar.client'
    );

    mounted = await mountClient(createElement(DesktopTopbar));
    const container = mounted.container;

    const btn = container.querySelector('button[data-motion]');
    await act(async () => {
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // applyMotion called in useLayoutEffect (once on mount with true) + once on click (with false)
    expect(applyMotionMock).toHaveBeenLastCalledWith(false);
  });
});
