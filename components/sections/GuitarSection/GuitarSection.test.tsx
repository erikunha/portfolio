import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GUITAR_MODULE_HEADER, guitarPresentation, guitarRig } from '@/content/guitar-rig';
import { SECTION_LABELS } from '@/content/section-labels';
import { GuitarContent, GuitarSection } from './GuitarSection';

async function renderContent(): Promise<Document> {
  const html = renderToStaticMarkup(await GuitarContent());
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('GuitarSection presentation', () => {
  it('replaces the signal chain cards with one EQ spectrum strip', async () => {
    const doc = await renderContent();
    expect(doc.querySelectorAll('[data-testid="eq-spectrum"]')).toHaveLength(1);
    expect(doc.querySelector('[data-testid^="signal-node-"]')).toBeNull();
    expect(doc.querySelector('.guitar-chain')).toBeNull();
    expect(doc.body.textContent).not.toContain('MODELED CAB');
  });

  it('shows the gear chain label as visible text', async () => {
    const doc = await renderContent();
    const label = doc.querySelector('[data-testid="eq-spectrum"] .eq-label');
    expect(label?.textContent).toBe(guitarRig.eqSpectrum.label);
  });

  it('names the plot as one image with the EQ bands in its accessible name', async () => {
    const doc = await renderContent();
    const plot = doc.querySelector('[data-testid="eq-spectrum"] [role="img"]');
    expect(plot).not.toBeNull();
    const name = plot?.getAttribute('aria-label') ?? '';
    expect(name).toContain(guitarRig.eqSpectrum.ariaLabel.prefix);
    expect(name).toContain('140 Hz');
    expect(name).toContain('2.8 kHz');
    expect(plot?.getAttribute('aria-hidden')).toBeNull();
  });

  it('draws every bar, the grid, the curve and the axis without scripts', async () => {
    const doc = await renderContent();
    const strip = doc.querySelector('[data-testid="eq-spectrum"]');
    expect(strip?.querySelectorAll('.eq-bar')).toHaveLength(guitarRig.eqSpectrum.barCount);
    expect(strip?.querySelector('.eq-bars')?.getAttribute('aria-hidden')).toBe('true');
    expect(strip?.querySelector('.eq-curve path')?.getAttribute('d')).toMatch(/^M/);
    expect(strip?.querySelector('.eq-grid path')?.getAttribute('d')).toMatch(/^M/);
    expect(
      Array.from(strip?.querySelectorAll('.eq-axis-tick') ?? [], (tick) => tick.textContent),
    ).toEqual(guitarRig.eqSpectrum.axis.map((tick) => tick.label));
    expect(strip?.querySelector('.eq-axis')?.getAttribute('aria-hidden')).toBe('true');
    expect(strip?.querySelector('script')).toBeNull();
  });

  it('gives each bar its own height and groove timing through custom properties', async () => {
    const doc = await renderContent();
    const bars = Array.from(doc.querySelectorAll<HTMLElement>('.eq-bar'));
    for (const bar of bars) {
      expect(bar.style.getPropertyValue('--eq-bar-height')).toMatch(/^[\d.]+%$/);
      expect(bar.style.getPropertyValue('--eq-bar-delay')).toMatch(/^[\d.]+s$/);
      expect(Number(bar.style.getPropertyValue('--eq-bar-cycle'))).toBeGreaterThanOrEqual(1);
    }
    const heights = new Set(bars.map((bar) => bar.style.getPropertyValue('--eq-bar-height')));
    expect(heights.size).toBeGreaterThan(10);
  });

  it('keeps ids out of the markup so the strip can render twice', async () => {
    const doc = await renderContent();
    expect(doc.querySelector('[data-testid="eq-spectrum"] [id]')).toBeNull();
  });

  it('reads the strip, then the photo, then the facts row', async () => {
    const doc = await renderContent();
    const influences = doc.querySelector('[data-testid="influences"]');
    expect(influences?.textContent).toContain(guitarPresentation.influences.label);
    expect(influences?.textContent).toContain(guitarPresentation.influences.text);
    expect(influences?.textContent).toContain(guitarPresentation.nowPlaying.label);
    expect(influences?.textContent).toContain(guitarPresentation.nowPlaying.text);
    const stats = Array.from(doc.querySelectorAll('[data-testid^="stat-"]'));
    expect(stats).toHaveLength(guitarPresentation.stats.length);
    for (const [index, stat] of guitarPresentation.stats.entries()) {
      expect(stats[index]?.textContent).toContain(stat.label);
      expect(stats[index]?.textContent).toContain(stat.value);
      expect(stats[index]?.textContent).toContain(stat.sub);
    }
    const ordered = Array.from(
      doc.querySelectorAll(
        '[data-testid="eq-spectrum"], img, [data-testid^="stat-"], [data-testid="influences"]',
      ),
    );
    expect(ordered).toEqual([
      doc.querySelector('[data-testid="eq-spectrum"]'),
      doc.querySelector('img'),
      ...stats,
      influences,
    ]);
  });

  it('puts the photo directly in the presentation and the facts after it', async () => {
    const doc = await renderContent();
    const presentation = doc.querySelector('.guitar-presentation');
    expect(doc.querySelector('.guitar-pair')).toBeNull();
    expect(doc.querySelector('.guitar-mixer')).toBeNull();
    expect(doc.querySelector('[data-testid="daw-mixer-desktop"]')).toBeNull();
    const photo = presentation?.querySelector(':scope > .guitar-photo');
    expect(photo).not.toBeNull();
    expect(photo?.nextElementSibling?.className).toBe('guitar-facts');
  });

  it('delivers the photo through Next Image with meaningful alt and reserved dimensions', async () => {
    const doc = await renderContent();
    const photo = doc.querySelector('img');
    expect(photo?.getAttribute('alt')).toBe(guitarPresentation.photo.alt);
    expect(photo?.getAttribute('alt')).toContain('Erik playing guitar');
    expect(photo?.getAttribute('width')).toBe(String(guitarPresentation.photo.width));
    expect(photo?.getAttribute('height')).toBe(String(guitarPresentation.photo.height));
    expect(photo?.getAttribute('src')).toContain(encodeURIComponent(guitarPresentation.photo.src));
    expect(photo?.getAttribute('srcset')).toBeTruthy();
    expect(doc.body.textContent).toContain(guitarRig.liveCam.caption);
  });

  it('pins the telemetry line at the photo bottom bar left and REC LIVE at its right', async () => {
    const doc = await renderContent();
    const bar = doc.querySelector('.guitar-photo-telemetry');
    expect(bar?.textContent).toContain(guitarRig.liveCam.telemetry);
    expect(bar?.textContent).toContain(guitarRig.liveCam.status);
    expect(bar?.querySelector('.guitar-photo-telemetry-status')?.textContent).toBe(
      guitarRig.liveCam.status,
    );
    expect(doc.querySelector('.guitar-camera-labels')?.textContent).toContain(
      guitarRig.liveCam.cameraLabel,
    );
    expect(doc.querySelector('.guitar-camera-labels')?.textContent).not.toContain('REC');
  });

  it('exposes a readable section heading and no per-node headings', () => {
    const html = renderToStaticMarkup(createElement(GuitarSection));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const section = doc.querySelector('section');
    const heading = doc.getElementById(section?.getAttribute('aria-labelledby') ?? '');
    expect(heading?.textContent).toContain(SECTION_LABELS['sec-guitar']);
    expect(doc.querySelector('#sec-guitar .guitar-presentation h3')).toBeNull();
  });

  it('shows the section name and the terminal command in the header', () => {
    const html = renderToStaticMarkup(createElement(GuitarSection));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const heading = doc.querySelector('h2');
    expect(heading?.textContent).toContain(GUITAR_MODULE_HEADER);
    expect(heading?.querySelector('.module-name')?.textContent).toBe(SECTION_LABELS['sec-guitar']);
  });

  it('renders the live signal chain strip above the EQ strip', async () => {
    const doc = await renderContent();
    const strip = doc.querySelector('.guitar-signal-strip');
    expect(strip?.textContent).toContain(guitarPresentation.signalStrip.live);
    expect(strip?.textContent).toContain(guitarPresentation.signalStrip.tail);
    const eq = doc.querySelector('[data-testid="eq-spectrum"]');
    expect(strip?.compareDocumentPosition(eq as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('renders no mixer markup: the DAW mixer is its own section below', () => {
    const html = renderToStaticMarkup(createElement(GuitarSection));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const section = doc.querySelector('section#sec-guitar');
    expect(section).not.toBeNull();
    expect(section?.querySelectorAll('[data-testid="daw-mixer-desktop"]')).toHaveLength(0);
    expect(section?.querySelectorAll('[data-testid^="channel-"]')).toHaveLength(0);
  });

  it('sizes the photo for the right-hand pair from 1024px and full width below', async () => {
    const doc = await renderContent();
    expect(doc.querySelector('img')?.getAttribute('sizes')).toBe('(min-width: 1024px) 38vw, 100vw');
  });
});
