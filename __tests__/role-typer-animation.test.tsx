// __tests__/role-typer-animation.test.tsx
// Behavioral tests for RoleTyper animation loop.
// Locks down: typing loop advances charIdx; hold/back/type phase transitions;
// live region updated only on full phrase; cancelled animation stops DOM mutation.

import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

vi.mock('@/lib/motion', () => ({
  readMotion: () => true,
}));

describe('RoleTyper — animation loop', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function render() {
    const { RoleTyper } = await import('@/components/client/RoleTyper/RoleTyper');
    mounted = await mountClient(createElement(RoleTyper));
    return mounted.container;
  }

  it('renders the animated pill span (aria-hidden) on mount', async () => {
    const container = await render();
    const pill = container.querySelector('[aria-hidden="true"]');
    // The pill exists; its initial textContent may already have started animating
    // since mountClient runs effects under act(). Assert existence only.
    expect(pill).not.toBeNull();
  });

  it('advances the typing loop — pill text grows as timer ticks advance', async () => {
    const container = await render();
    const pill = container.querySelector('[aria-hidden="true"]');
    // After mount the first tick() fires immediately. Then each subsequent char
    // takes TYPE_MS=80ms. After enough ticks the full role is typed.
    // Advance past all 6 chars of 'Senior'
    await act(async () => {
      await vi.advanceTimersByTimeAsync(80 * 7); // 7 ticks for safety
    });
    expect(pill?.textContent).toBe('[Senior]');
  });

  it('types out the full word "Senior" in the pill', async () => {
    const container = await render();
    const pill = container.querySelector('[aria-hidden="true"]');
    // 'Senior' = 6 chars; TYPE_MS=80ms each; first char was already typed on mount
    // so 5 more ticks needed. Advance 6*80ms total for safety.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(80 * 6);
    });
    expect(pill?.textContent).toBe('[Senior]');
  });

  it('updates the live region only when a full role is completed', async () => {
    const container = await render();
    const liveRegion = container.querySelector('[role="status"]');

    // After full typing of 'Senior' and hold: live region is updated
    // Type 6 chars (80ms each) + some buffer
    await act(async () => {
      await vi.advanceTimersByTimeAsync(80 * 8);
    });
    expect(liveRegion?.textContent).toBe('Senior');
  });

  it('enters back phase after hold and reduces text', async () => {
    const container = await render();
    const pill = container.querySelector('[aria-hidden="true"]');
    // Type 'Senior' (6*80=480ms) + hold (HOLD_MS=2000ms) + back starts (BACK_MS=40ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(80 * 6 + 2000 + 40 + 40);
    });
    // After type + hold + a couple of back ticks, charIdx < 6
    expect(pill?.textContent?.length).toBeLessThan('[Senior]'.length);
  });

  it('cycles to the next role after backspacing to empty', async () => {
    const container = await render();
    const pill = container.querySelector('[aria-hidden="true"]');
    // type Senior: 6*80=480ms
    // hold: 2000ms
    // back 6 chars: 6*40=240ms
    // inter delay: 300ms
    // type chars of 'Staff': several * 80ms
    // After the full cycle, pill should contain content from 'Staff'
    await act(async () => {
      await vi.advanceTimersByTimeAsync(480 + 2000 + 240 + 300 + 80 * 5 + 200);
    });
    // Should be in 'Staff' territory
    const text = pill?.textContent ?? '';
    expect(text).toMatch(/^\[Sta/);
  });

  it('stops mutating DOM after unmount (cleanup cancels animation)', async () => {
    const container = await render();
    const pill = container.querySelector('[aria-hidden="true"]');
    // Let partial typing occur
    await act(async () => {
      await vi.advanceTimersByTimeAsync(80 * 3);
    });
    const textAfterPartial = pill?.textContent;

    // Unmount — cleanup sets cancelled=true
    mounted.unmount();

    // Advance timers; no further mutation should occur
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    // pill is detached, but textContent shouldn't have changed
    // (the cancelled flag prevents further ticks)
    expect(pill?.textContent).toBe(textAfterPartial);
  });
});

describe('RoleTyper — motion off (no animation)', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  it('does not start the tick loop when readMotion returns false', async () => {
    vi.doMock('@/lib/motion', () => ({ readMotion: () => false }));
    const { RoleTyper } = await import('@/components/client/RoleTyper/RoleTyper');
    mounted = await mountClient(createElement(RoleTyper));
    const container = mounted.container;
    const pill = container.querySelector('[aria-hidden="true"]');
    // When motion is off, useEffect returns early — pill retains initial SSR text
    expect(pill?.textContent).toBe('[Senior]');
  });
});
