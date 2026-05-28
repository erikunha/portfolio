// components/client/DawMixer/VuMeter.test.tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { mountClient } from '@/__tests__/helpers/render';
import { VuMeter } from './VuMeter.client';

function renderStatic(props: Parameters<typeof VuMeter>[0]) {
  const html = renderToStaticMarkup(createElement(VuMeter, props));
  return new DOMParser().parseFromString(html, 'text/html');
}

const defaults = { segments: 14, initialLevel: 70, channelName: 'RHYTHM GTR' };

describe('VuMeter — ARIA contract', () => {
  it('has role="slider"', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')).not.toBeNull();
  });

  it('aria-valuenow equals initialLevel', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')).toBe('70');
  });

  it('aria-valuemin is 0 and aria-valuemax is 100', () => {
    const doc = renderStatic(defaults);
    const slider = doc.querySelector('[role="slider"]');
    expect(slider?.getAttribute('aria-valuemin')).toBe('0');
    expect(slider?.getAttribute('aria-valuemax')).toBe('100');
  });

  it('aria-valuetext shows initialLevel as percentage', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')?.getAttribute('aria-valuetext')).toBe('70%');
  });

  it('aria-label includes channel name and "VU meter"', () => {
    const doc = renderStatic(defaults);
    const label = doc.querySelector('[role="slider"]')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('RHYTHM GTR');
    expect(label.toLowerCase()).toContain('vu meter');
  });

  it('is focusable (tabIndex 0)', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')?.getAttribute('tabindex')).toBe('0');
  });
});

describe('VuMeter — segments', () => {
  it('renders the correct number of segments', () => {
    const doc = renderStatic({ ...defaults, segments: 14 });
    // Each segment is a <span> child of the slider
    const slider = doc.querySelector('[role="slider"]');
    expect(slider?.querySelectorAll('span').length).toBe(14);
  });

  it('no red segments when clipping is false and level is high', () => {
    // Even at level 95 with no clipping prop, no red segment class
    const doc = renderStatic({ ...defaults, initialLevel: 95, clipping: false });
    expect(doc.querySelector('[class*="vuSegRed"]')).toBeNull();
  });

  it('last 2 filled segments get red class when clipping=true and level fills both red-zone slots', () => {
    // initialLevel:97 with segments:14 → filledCount=14, so both red-zone slots (12,13) are filled
    const doc = renderStatic({ ...defaults, initialLevel: 97, clipping: true });
    expect(doc.querySelectorAll('[class*="vuSegRed"]').length).toBe(2);
  });

  it('only filled red-zone segments get red class — unfilled slots stay empty', () => {
    // initialLevel:93 with segments:14 → filledCount=13: slot 12 is red+filled, slot 13 is empty
    const doc = renderStatic({ ...defaults, initialLevel: 93, clipping: true });
    expect(doc.querySelectorAll('[class*="vuSegRed"]').length).toBe(1);
    expect(doc.querySelector('[class*="vuSegEmpty"]')).not.toBeNull();
  });
});

describe('VuMeter — keyboard', () => {
  let unmount: (() => void) | undefined;
  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  it('ArrowRight increases level by 5', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(VuMeter, { ...defaults, initialLevel: 50 }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(slider.getAttribute('aria-valuenow')).toBe('55');
  });

  it('ArrowLeft decreases level by 5', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(VuMeter, { ...defaults, initialLevel: 50 }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(slider.getAttribute('aria-valuenow')).toBe('45');
  });

  it('clamps to 0 at minimum', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(VuMeter, { ...defaults, initialLevel: 2 }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(0);
  });

  it('clamps to 100 at maximum', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(VuMeter, { ...defaults, initialLevel: 97 }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(100);
  });

  it('keyboard ignored during active pointer drag', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(VuMeter, { ...defaults, initialLevel: 50 }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;

    Object.defineProperty(slider, 'getBoundingClientRect', {
      value: () => ({ left: 0, right: 100, width: 100, top: 0, bottom: 20, height: 20 }),
      configurable: true,
    });

    slider.dispatchEvent(new PointerEvent('pointerdown', { clientX: 50, bubbles: true }));
    slider.dispatchEvent(new PointerEvent('pointermove', { clientX: 80, bubbles: true }));
    expect(slider.getAttribute('aria-valuenow')).toBe('80');

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(slider.getAttribute('aria-valuenow')).toBe('80');
  });
});

describe('VuMeter — pointer drag behavior', () => {
  let unmount: (() => void) | undefined;
  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  it('pointermove without pointerdown does not change level', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(VuMeter, { ...defaults, initialLevel: 50 }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new PointerEvent('pointermove', { clientX: 300, bubbles: true }));
    expect(slider.getAttribute('aria-valuenow')).toBe('50');
  });

  it('aria-valuenow is always a valid integer after pointer events', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(VuMeter, { ...defaults, initialLevel: 50 }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, bubbles: true }));
    slider.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, bubbles: true }));
    slider.dispatchEvent(new PointerEvent('pointerup', { clientX: 200, bubbles: true }));
    const val = Number(slider.getAttribute('aria-valuenow'));
    expect(Number.isNaN(val)).toBe(false);
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(100);
  });

  it('updates aria-valuenow and aria-valuetext via ref mutation during drag', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(VuMeter, { segments: 10, initialLevel: 10, channelName: 'TEST' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;

    Object.defineProperty(slider, 'getBoundingClientRect', {
      value: () => ({ left: 0, right: 100, width: 100, top: 0, bottom: 20, height: 20 }),
      configurable: true,
    });

    slider.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, bubbles: true }));
    slider.dispatchEvent(new PointerEvent('pointermove', { clientX: 80, bubbles: true }));
    expect(slider.getAttribute('aria-valuenow')).toBe('80');
    expect(slider.getAttribute('aria-valuetext')).toBe('80%');
  });

  it('pointercancel restores level to drag-start value', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(VuMeter, { ...defaults, initialLevel: 50 }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;

    Object.defineProperty(slider, 'getBoundingClientRect', {
      value: () => ({ left: 0, right: 100, width: 100, top: 0, bottom: 20, height: 20 }),
      configurable: true,
    });

    slider.dispatchEvent(new PointerEvent('pointerdown', { clientX: 50, bubbles: true }));
    slider.dispatchEvent(new PointerEvent('pointermove', { clientX: 90, bubbles: true }));
    expect(slider.getAttribute('aria-valuenow')).toBe('90');

    slider.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
    expect(slider.getAttribute('aria-valuenow')).toBe('50');
  });
});
