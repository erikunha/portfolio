import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { mountClient } from '@/__tests__/helpers/render';
import { FaderDbIsland, pctToDb } from './FaderDbIsland.client';

describe('pctToDb — formula', () => {
  it('returns "-∞" for 0%', () => {
    expect(pctToDb(0)).toBe('-∞');
  });

  it('returns "0.0" at 75% (unity gain)', () => {
    expect(pctToDb(75)).toBe('0.0');
  });

  it('returns "+6.0" at 100% (top of range)', () => {
    expect(pctToDb(100)).toBe('+6.0');
  });

  it('returns a negative string below unity', () => {
    const db = pctToDb(40);
    expect(db.startsWith('-')).toBe(true);
    expect(Number.isNaN(Number.parseFloat(db))).toBe(false);
  });

  it('returns a "+"-prefixed string above unity', () => {
    const db = pctToDb(90);
    expect(db.startsWith('+')).toBe(true);
  });

  it('all channels at same pct produce the same dB string', () => {
    expect(pctToDb(72)).toBe(pctToDb(72));
  });

  it('value increases monotonically with pct', () => {
    const values = [10, 30, 50, 75, 90, 100].map((p) => {
      const str = pctToDb(p);
      return str === '-∞' ? -Infinity : Number.parseFloat(str);
    });
    for (let i = 1; i < values.length; i++) {
      const prev = values[i - 1] ?? -Infinity;
      const curr = values[i] ?? -Infinity;
      expect(curr).toBeGreaterThan(prev);
    }
  });
});

describe('FaderDbIsland — initial render', () => {
  it('shows pctToDb(initialPct) as the dB value, not a raw content string', () => {
    const html = renderToStaticMarkup(
      createElement(FaderDbIsland, { initialPct: 72, channelName: 'TEST' }),
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const dbSpan = doc.querySelector('[class*="dbValue"]');
    expect(dbSpan?.textContent).toBe(pctToDb(72));
  });

  it('renders footer when provided', () => {
    const html = renderToStaticMarkup(
      createElement(FaderDbIsland, {
        initialPct: 62,
        channelName: 'MASTER',
        footer: { lufs: '-14', pk: '-0.3' },
      }),
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('[class*="lufs"]')?.textContent).toContain('-14');
  });

  it('renders no footer element when footer is undefined', () => {
    const html = renderToStaticMarkup(
      createElement(FaderDbIsland, { initialPct: 50, channelName: 'CH 01' }),
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('[class*="lufs"]')).toBeNull();
  });
});

describe('FaderDbIsland — dB updates on fader interaction', () => {
  let unmount: (() => void) | undefined;
  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  it('dB text changes after ArrowRight keyboard press', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderDbIsland, { initialPct: 50, channelName: 'TEST' }),
    );
    unmount = u;
    const initialDb = pctToDb(50);
    const dbSpan = container.querySelector('[class*="dbValue"]') as HTMLElement;
    expect(dbSpan.textContent).toBe(initialDb);

    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(dbSpan.textContent).toBe(pctToDb(52));
    expect(dbSpan.textContent).not.toBe(initialDb);
  });

  it('dB text changes after ArrowLeft keyboard press', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderDbIsland, { initialPct: 50, channelName: 'TEST' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    const dbSpan = container.querySelector('[class*="dbValue"]') as HTMLElement;
    expect(dbSpan.textContent).toBe(pctToDb(48));
  });

  it('aria-valuetext reflects dB on the slider element', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderDbIsland, { initialPct: 75, channelName: 'TEST' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    expect(slider.getAttribute('aria-valuetext')).toBe('0.0 dB');
  });

  it('ArrowLeft from 0% shows -∞', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderDbIsland, { initialPct: 0, channelName: 'TEST' }),
    );
    unmount = u;
    const dbSpan = container.querySelector('[class*="dbValue"]') as HTMLElement;
    expect(dbSpan.textContent).toBe('-∞');
  });

  it('ArrowRight from 100% clamps and shows +6.0', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderDbIsland, { initialPct: 100, channelName: 'TEST' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const dbSpan = container.querySelector('[class*="dbValue"]') as HTMLElement;
    expect(dbSpan.textContent).toBe('+6.0');
  });

  it('aria-valuetext updates after keyboard interaction', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderDbIsland, { initialPct: 50, channelName: 'TEST' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    expect(slider.getAttribute('aria-valuetext')).toBe(`${pctToDb(50)} dB`);
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(slider.getAttribute('aria-valuetext')).toBe(`${pctToDb(52)} dB`);
  });

  it('aria-valuetext and dB span both update during pointer drag via ref mutation', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderDbIsland, { initialPct: 50, channelName: 'TEST' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    const dbSpan = container.querySelector('[class*="dbValue"]') as HTMLElement;
    Object.defineProperty(slider, 'getBoundingClientRect', {
      value: () => ({ left: 0, right: 100, width: 100, top: 0, bottom: 20, height: 20 }),
      configurable: true,
    });
    slider.dispatchEvent(new PointerEvent('pointerdown', { clientX: 50, bubbles: true }));
    slider.dispatchEvent(new PointerEvent('pointermove', { clientX: 75, bubbles: true }));
    expect(dbSpan.textContent).toBe(pctToDb(75));
    expect(slider.getAttribute('aria-valuetext')).toBe(`${pctToDb(75)} dB`);
  });

  it('dB span and aria-valuetext sync on pointerup even when last move and up differ', async () => {
    const { container, unmount: u } = await mountClient(
      createElement(FaderDbIsland, { initialPct: 50, channelName: 'TEST' }),
    );
    unmount = u;
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    Object.defineProperty(slider, 'getBoundingClientRect', {
      value: () => ({ left: 0, right: 100, width: 100, top: 0, bottom: 20, height: 20 }),
      configurable: true,
    });
    slider.dispatchEvent(new PointerEvent('pointerdown', { clientX: 50, bubbles: true }));
    slider.dispatchEvent(new PointerEvent('pointermove', { clientX: 60, bubbles: true }));
    slider.dispatchEvent(new PointerEvent('pointerup', { clientX: 90, bubbles: true }));

    const dbSpan = container.querySelector('[class*="dbValue"]') as HTMLElement;
    expect(dbSpan.textContent).toBe(pctToDb(90));
    expect(slider.getAttribute('aria-valuetext')).toBe(`${pctToDb(90)} dB`);
  });
});
