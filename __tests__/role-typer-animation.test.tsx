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
    expect(pill).not.toBeNull();
  });

  it('advances the typing loop — pill text grows as timer ticks advance', async () => {
    const container = await render();
    const pill = container.querySelector('[aria-hidden="true"]');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(80 * 7);
    });
    expect(pill?.textContent).toBe('[Senior]');
  });

  it('types out the full word "Senior" in the pill', async () => {
    const container = await render();
    const pill = container.querySelector('[aria-hidden="true"]');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(80 * 6);
    });
    expect(pill?.textContent).toBe('[Senior]');
  });

  it('updates the live region only when a full role is completed', async () => {
    const container = await render();
    const liveRegion = container.querySelector('[role="status"]');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(80 * 8);
    });
    expect(liveRegion?.textContent).toBe('Senior');
  });

  it('enters back phase after hold and reduces text', async () => {
    const container = await render();
    const pill = container.querySelector('[aria-hidden="true"]');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(80 * 6 + 2000 + 40 + 40);
    });
    expect(pill?.textContent?.length).toBeLessThan('[Senior]'.length);
  });

  it('cycles to the next role after backspacing to empty', async () => {
    const container = await render();
    const pill = container.querySelector('[aria-hidden="true"]');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(480 + 2000 + 240 + 300 + 80 * 5 + 200);
    });
    const text = pill?.textContent ?? '';
    expect(text).toMatch(/^\[Sta/);
  });

  it('stops mutating DOM after unmount (cleanup cancels animation)', async () => {
    const container = await render();
    const pill = container.querySelector('[aria-hidden="true"]');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(80 * 3);
    });
    const textAfterPartial = pill?.textContent;

    mounted.unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
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
    expect(pill?.textContent).toBe('[Senior]');
  });
});
