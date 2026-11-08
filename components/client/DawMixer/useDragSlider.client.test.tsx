import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { type DragSliderConfig, useDragSlider } from './useDragSlider.client';

type Harness = Partial<DragSliderConfig> & { live: { value: number } };

function Slider(props: Harness) {
  const { live, ...overrides } = props;
  const handlers = useDragSlider({
    read: () => live.value,
    apply: (value) => {
      live.value = value;
    },
    valueAt: (event) => event.clientX,
    applyOnDown: true,
    settleOn: 'live',
    keys: { min: 0, max: 100, step: 5 },
    ...overrides,
  });
  return createElement('div', { 'data-testid': 'slider', ...handlers });
}

let mounted: MountedClient;
afterEach(() => mounted?.unmount());

async function mount(props: Harness): Promise<HTMLElement> {
  mounted = await mountClient(createElement(Slider, props));
  return mounted.container.querySelector('[data-testid="slider"]') as HTMLElement;
}

const pointer = (type: string, clientX: number, clientY = 0) =>
  new PointerEvent(type, { clientX, clientY, bubbles: true, pointerId: 1 });

const fire = (el: HTMLElement, event: Event) => act(() => void el.dispatchEvent(event));

describe('useDragSlider', () => {
  it('survives a refused pointer capture and still drags', async () => {
    const live = { value: 10 };
    const el = await mount({ live });
    el.setPointerCapture = () => {
      throw new Error('NotFoundError');
    };
    fire(el, pointer('pointerdown', 40));
    fire(el, pointer('pointermove', 60));
    expect(live.value).toBe(60);
  });

  it('restores the pre-drag value and commits it when the gesture is cancelled', async () => {
    const live = { value: 10 };
    const commit = vi.fn();
    const el = await mount({ live, commit });
    fire(el, pointer('pointerdown', 40));
    fire(el, pointer('pointermove', 90));
    fire(el, pointer('pointercancel', 90));
    expect(live.value).toBe(10);
    expect(commit).toHaveBeenCalledWith(10);
  });

  it('ignores moves and cancels when no drag is active', async () => {
    const live = { value: 10 };
    const commit = vi.fn();
    const el = await mount({ live, commit });
    fire(el, pointer('pointermove', 70));
    fire(el, pointer('pointercancel', 70));
    fire(el, pointer('pointerup', 70));
    expect(live.value).toBe(10);
    expect(commit).not.toHaveBeenCalled();
  });

  it('commits the live value on release when it settles on the live value', async () => {
    const live = { value: 10 };
    const commit = vi.fn();
    const el = await mount({ live, commit, settleOn: 'live' });
    fire(el, pointer('pointerdown', 40));
    fire(el, pointer('pointermove', 60));
    fire(el, pointer('pointerup', 80));
    expect(live.value).toBe(60);
    expect(commit).toHaveBeenCalledWith(60);
  });

  it('applies and commits the release point when it settles on the pointer', async () => {
    const live = { value: 10 };
    const commit = vi.fn();
    const el = await mount({ live, commit, settleOn: 'pointer' });
    fire(el, pointer('pointerdown', 40));
    fire(el, pointer('pointermove', 60));
    fire(el, pointer('pointerup', 80));
    expect(live.value).toBe(80);
    expect(commit).toHaveBeenCalledWith(80);
  });

  it('does not move the value on press when applyOnDown is false', async () => {
    const live = { value: 10 };
    const el = await mount({ live, applyOnDown: false });
    fire(el, pointer('pointerdown', 40));
    expect(live.value).toBe(10);
  });

  it('steps by key, normalizes, and ignores keys during a drag', async () => {
    const live = { value: 10 };
    const commit = vi.fn();
    const el = await mount({ live, commit, normalizeKey: (value) => Math.round(value / 10) * 10 });
    fire(el, new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(live.value).toBe(20);
    expect(commit).toHaveBeenLastCalledWith(20);
    fire(el, pointer('pointerdown', 50));
    fire(el, new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    expect(live.value).toBe(50);
  });
});
