import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { fire, mountClient } from '@/__tests__/helpers/render';
import { dawMixerCopy } from '@/content/daw-mixer';
import { SITE_LOCALE } from '@/content/site-locale';
import { FaderIsland } from './FaderIsland/FaderIsland.client';
import { KnobIsland } from './KnobIsland/KnobIsland.client';
import { VuMeter } from './VuMeter/VuMeter.client';

const CONTROLS = dawMixerCopy[SITE_LOCALE.en].controls;

type Case = {
  name: string;
  element: () => ReturnType<typeof createElement>;
  min: number;
  max: number;
  start: number;
  step: number;
};

const CASES: Case[] = [
  {
    name: 'fader',
    element: () =>
      createElement(FaderIsland, {
        initialPct: 50,
        channelName: 'LEAD GTR',
        label: CONTROLS.fader,
      }),
    min: 0,
    max: 100,
    start: 50,
    step: 2,
  },
  {
    name: 'vu meter',
    element: () =>
      createElement(VuMeter, {
        segments: 12,
        initialLevel: 50,
        channelName: 'LEAD GTR',
        label: CONTROLS.vuMeter,
      }),
    min: 0,
    max: 100,
    start: 50,
    step: 5,
  },
  {
    name: 'knob',
    element: () =>
      createElement(KnobIsland, {
        initialAngle: 0,
        label: 'GAIN',
        channelName: 'LEAD GTR',
        degreesUnit: CONTROLS.degrees,
      }),
    min: -150,
    max: 150,
    start: 0,
    step: 5,
  },
];

describe.each(CASES)('$name follows the slider keyboard contract', (spec) => {
  let unmount: (() => void) | undefined;

  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  async function mount() {
    const mounted = await mountClient(spec.element());
    unmount = mounted.unmount;
    const slider = mounted.container.querySelector('[role="slider"]') as HTMLElement;
    const press = (key: string) =>
      fire(slider, new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    const value = () => Number(slider.getAttribute('aria-valuenow'));
    return { slider, press, value };
  }

  it.each(['ArrowRight', 'ArrowUp'])('%s raises the value by one step', async (key) => {
    const { press, value } = await mount();
    press(key);
    expect(value(), `${key} must raise a slider by its step`).toBe(spec.start + spec.step);
  });

  it.each(['ArrowLeft', 'ArrowDown'])('%s lowers the value by one step', async (key) => {
    const { press, value } = await mount();
    press(key);
    expect(value(), `${key} must lower a slider by its step`).toBe(spec.start - spec.step);
  });

  it('Home jumps to the minimum and End to the maximum', async () => {
    const { press, value } = await mount();
    press('Home');
    expect(value(), 'Home must jump to the minimum').toBe(spec.min);
    press('End');
    expect(value(), 'End must jump to the maximum').toBe(spec.max);
  });

  it('PageUp and PageDown move by more than one step and stay in range', async () => {
    const { press, value } = await mount();
    press('PageUp');
    expect(value()).toBeGreaterThan(spec.start + spec.step);
    press('End');
    press('PageUp');
    expect(value()).toBe(spec.max);
    press('Home');
    press('PageDown');
    expect(value()).toBe(spec.min);
  });

  it('ignores other keys', async () => {
    const { press, value } = await mount();
    press('a');
    expect(value()).toBe(spec.start);
  });

  it('is not a live region, because a slider announces its own value', async () => {
    const { slider } = await mount();
    expect(slider.hasAttribute('aria-live')).toBe(false);
    expect(slider.hasAttribute('aria-atomic')).toBe(false);
  });
});
