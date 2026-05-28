// components/client/DawMixer/FaderIsland.test.tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { mountClient } from '@/__tests__/helpers/render';
import { FaderIsland } from './FaderIsland.client';

function renderStatic(props: Parameters<typeof FaderIsland>[0]) {
  const html = renderToStaticMarkup(createElement(FaderIsland, props));
  return new DOMParser().parseFromString(html, 'text/html');
}

const defaults = { initialPct: 72, channelName: 'RHYTHM GTR' };

describe('FaderIsland — ARIA contract', () => {
  it('has role="slider"', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')).not.toBeNull();
  });

  it('aria-valuenow equals initialPct', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')).toBe('72');
  });

  it('aria-valuemin is 0 and aria-valuemax is 100', () => {
    const doc = renderStatic(defaults);
    const slider = doc.querySelector('[role="slider"]');
    expect(slider?.getAttribute('aria-valuemin')).toBe('0');
    expect(slider?.getAttribute('aria-valuemax')).toBe('100');
  });

  it('aria-label includes channel name and "fader"', () => {
    const doc = renderStatic(defaults);
    const label = doc.querySelector('[role="slider"]')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('RHYTHM GTR');
    expect(label.toLowerCase()).toContain('fader');
  });

  it('is focusable (tabIndex 0)', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')?.getAttribute('tabindex')).toBe('0');
  });

  it('thumb is aria-hidden (visual only)', () => {
    const doc = renderStatic(defaults);
    const thumb = doc.querySelector('[class*="faderThumb"]');
    expect(thumb?.getAttribute('aria-hidden')).toBe('true');
  });

  it('aria-valuetext shows initialPct as percentage', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')?.getAttribute('aria-valuetext')).toBe('72%');
  });
});

describe('FaderIsland — keyboard', () => {
  let unmount: (() => void) | undefined;
  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  it('ArrowRight increases position by 2', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderIsland, { initialPct: 50, channelName: 'TEST' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBe(52);
  });

  it('ArrowLeft decreases position by 2', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderIsland, { initialPct: 50, channelName: 'TEST' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBe(48);
  });

  it('clamps to 0 at minimum', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderIsland, { initialPct: 1, channelName: 'TEST' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(0);
  });

  it('clamps to 100 at maximum', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderIsland, { initialPct: 99, channelName: 'TEST' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(100);
  });
});

describe('FaderIsland — pointer drag behavior', () => {
  let unmount: (() => void) | undefined;
  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  it('pointermove without pointerdown does not change position', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderIsland, { initialPct: 50, channelName: 'TEST' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new PointerEvent('pointermove', { clientX: 300, bubbles: true }));
    expect(slider.getAttribute('aria-valuenow')).toBe('50');
  });

  it('aria-valuenow is always a valid integer after pointer events', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderIsland, { initialPct: 50, channelName: 'TEST' }),
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

  it('pointercancel restores position to drag-start value', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderIsland, { initialPct: 50, channelName: 'TEST' }),
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

    slider.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
    expect(slider.getAttribute('aria-valuenow')).toBe('50');
  });
});
