import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { fire, mountClient } from '@/__tests__/helpers/render';
import { dawMixerCopy } from '@/content/daw-mixer';
import { SITE_LOCALE } from '@/content/site-locale';
import { KnobIsland } from './KnobIsland.client';

const CONTROLS = dawMixerCopy[SITE_LOCALE.en].controls;
const DIAL_TOP = 100;
const DIAL_SIZE = 26;
const UPPER_HALF_Y = DIAL_TOP + 4;
const LOWER_HALF_Y = DIAL_TOP + DIAL_SIZE - 4;
const TAP_STEP = 15;

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  unmount = undefined;
});

async function mountKnob(initialAngle: number) {
  const mounted = await mountClient(
    createElement(KnobIsland, {
      initialAngle,
      label: 'GAIN',
      channelName: 'CH 01',
      degreesUnit: CONTROLS.degrees,
      hint: CONTROLS.knobHint,
    }),
  );
  unmount = mounted.unmount;
  const slider = mounted.container.querySelector('[role="slider"]') as HTMLElement;
  const dial = slider.querySelector('svg') as SVGElement;
  dial.getBoundingClientRect = () =>
    ({ top: DIAL_TOP, bottom: DIAL_TOP + DIAL_SIZE, height: DIAL_SIZE }) as DOMRect;
  return slider;
}

function tap(slider: HTMLElement, y: number, releaseY = y) {
  fire(slider, new PointerEvent('pointerdown', { clientX: 10, clientY: y, bubbles: true }));
  fire(slider, new PointerEvent('pointerup', { clientX: 10, clientY: releaseY, bubbles: true }));
}

const angleOf = (slider: HTMLElement) => Number(slider.getAttribute('aria-valuenow'));

describe('KnobIsland single-pointer alternative (WCAG 2.5.7)', () => {
  it('a tap on the upper half of the dial raises the angle without any drag', async () => {
    const slider = await mountKnob(0);
    tap(slider, UPPER_HALF_Y);
    expect(angleOf(slider)).toBe(TAP_STEP);
  });

  it('a tap on the lower half of the dial lowers the angle without any drag', async () => {
    const slider = await mountKnob(0);
    tap(slider, LOWER_HALF_Y);
    expect(angleOf(slider)).toBe(-TAP_STEP);
  });

  it('states the new angle in the spoken value', async () => {
    const slider = await mountKnob(0);
    tap(slider, UPPER_HALF_Y);
    expect(slider.getAttribute('aria-valuetext')).toBe(`+${TAP_STEP} degrees`);
  });

  it('stays inside the knob range', async () => {
    const slider = await mountKnob(148);
    tap(slider, UPPER_HALF_Y);
    expect(angleOf(slider)).toBe(150);
  });

  it('a drag that moves the pointer does not also step the angle on release', async () => {
    const slider = await mountKnob(0);
    fire(
      slider,
      new PointerEvent('pointerdown', { clientX: 10, clientY: LOWER_HALF_Y, bubbles: true }),
    );
    fire(
      slider,
      new PointerEvent('pointermove', { clientX: 10, clientY: LOWER_HALF_Y - 20, bubbles: true }),
    );
    const dragged = angleOf(slider);
    fire(
      slider,
      new PointerEvent('pointerup', { clientX: 10, clientY: LOWER_HALF_Y - 20, bubbles: true }),
    );
    expect(angleOf(slider)).toBe(dragged);
  });

  it('describes the tap gesture to assistive technology and hover', async () => {
    const slider = await mountKnob(0);
    expect(slider.getAttribute('title')).toBe(CONTROLS.knobHint);
  });
});
