import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { mountClient } from '@/__tests__/helpers/render';
import { KnobIsland } from './KnobIsland.client';

function renderStatic(props: Parameters<typeof KnobIsland>[0]) {
  const html = renderToStaticMarkup(createElement(KnobIsland, props));
  return new DOMParser().parseFromString(html, 'text/html');
}

const defaults = { initialAngle: -30, label: 'GAIN', channelName: 'LEAD GTR' };

describe('KnobIsland — ARIA contract', () => {
  it('has role="slider"', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')).not.toBeNull();
  });

  it('aria-valuenow equals initialAngle', () => {
    const doc = renderStatic(defaults);
    expect(doc.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')).toBe('-30');
  });

  it('aria-valuemin is -150, aria-valuemax is 150', () => {
    const doc = renderStatic(defaults);
    const slider = doc.querySelector('[role="slider"]');
    expect(slider?.getAttribute('aria-valuemin')).toBe('-150');
    expect(slider?.getAttribute('aria-valuemax')).toBe('150');
  });

  it('aria-label includes channel name and label', () => {
    const doc = renderStatic(defaults);
    const label = doc.querySelector('[role="slider"]')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('LEAD GTR');
    expect(label).toContain('GAIN');
  });
});

describe('KnobIsland — keyboard (clamp + direction)', () => {
  let unmount: (() => void) | undefined;
  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  it('ArrowUp increases angle by 5', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(KnobIsland, { initialAngle: 0, label: 'PAN', channelName: 'CH 01' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as SVGElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBe(5);
  });

  it('ArrowDown decreases angle by 5', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(KnobIsland, { initialAngle: 0, label: 'PAN', channelName: 'CH 01' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as SVGElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBe(-5);
  });

  it('clamps at +150 (does not exceed maximum)', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(KnobIsland, { initialAngle: 148, label: 'GAIN', channelName: 'CH 01' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as SVGElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(150);
  });

  it('clamps at -150 (does not go below minimum)', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(KnobIsland, { initialAngle: -148, label: 'GAIN', channelName: 'CH 01' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as SVGElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(-150);
  });
});

describe('KnobIsland — pointer drag behavior', () => {
  let unmount: (() => void) | undefined;
  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  it('pointercancel restores angle to drag-start value', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(KnobIsland, { initialAngle: -30, label: 'GAIN', channelName: 'CH 01' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;

    slider.dispatchEvent(new PointerEvent('pointerdown', { clientY: 100, bubbles: true }));
    // drag up 50px → deltaY=50 → newAngle = -30 + 50*1.5 = 45
    slider.dispatchEvent(new PointerEvent('pointermove', { clientY: 50, bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBe(45);
    expect(slider.getAttribute('aria-valuetext')).toBe('+45 degrees');

    slider.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
    expect(Number(slider.getAttribute('aria-valuenow'))).toBe(-30);
    expect(slider.getAttribute('aria-valuetext')).toBe('-30 degrees');
  });
});
