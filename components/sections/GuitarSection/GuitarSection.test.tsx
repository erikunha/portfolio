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
  it('renders exactly INPUT, AMP and OUT in signal order without the FX tuple', async () => {
    const doc = await renderContent();
    const nodes = Array.from(doc.querySelectorAll('[data-testid^="signal-node-"]'));
    expect(nodes.map((node) => node.getAttribute('data-testid'))).toEqual([
      'signal-node-INPUT',
      'signal-node-AMP',
      'signal-node-OUT',
    ]);
    for (const node of guitarPresentation.signalChain) {
      const displayed = doc.querySelector(`[data-testid="signal-node-${node.role}"]`);
      expect(displayed?.textContent).toContain(node.name);
      expect(displayed?.textContent).toContain(node.subtitle);
    }
    expect(doc.body.textContent).not.toContain(guitarRig.signalChain[1].name);
    expect(doc.querySelector('[data-testid="fx-list"]')).toBeNull();
    expect(doc.querySelector('[data-testid="signal-node-FX"]')).toBeNull();
    expect(doc.querySelector('[data-testid="fx-bullet"]')).toBeNull();
  });

  it('exposes each node signal strength as a named image matching the visible bars', async () => {
    const doc = await renderContent();
    const expectedNames = ['4 of 8', '3 of 8', '5 of 8'];
    expect(doc.querySelectorAll('.guitar-bars')).toHaveLength(expectedNames.length);
    for (const [index, node] of guitarPresentation.signalChain.entries()) {
      const displayed = doc.querySelector(`[data-testid="signal-node-${node.role}"]`);
      expect(displayed).not.toBeNull();
      if (!displayed) throw new Error(`Missing signal node ${node.role}`);
      const bars = displayed.querySelector('.guitar-bars[role="img"]');
      if (!bars) throw new Error(`Missing named bars for ${node.role}`);
      expect(bars.getAttribute('aria-label')).toBe(expectedNames[index]);
      expect(bars.getAttribute('aria-hidden')).toBeNull();
      expect(bars.querySelectorAll('.guitar-bar')).toHaveLength(8);
      expect(bars.querySelectorAll('[data-filled="true"]')).toHaveLength(node.strengthDots);
    }
  });

  it('reads influences, Now Playing, stats and photo after the signal flow', async () => {
    const doc = await renderContent();
    const prose = doc.querySelector('p');
    expect(prose?.textContent).toContain(guitarPresentation.influences.label);
    expect(prose?.textContent).toContain(guitarPresentation.influences.text);
    expect(prose?.textContent).toContain(guitarPresentation.nowPlaying.label);
    expect(prose?.textContent).toContain(guitarPresentation.nowPlaying.text);
    const stats = Array.from(doc.querySelectorAll('[data-testid^="stat-"]'));
    expect(stats).toHaveLength(guitarPresentation.stats.length);
    for (const [index, stat] of guitarPresentation.stats.entries()) {
      expect(stats[index]?.textContent).toContain(stat.label);
      expect(stats[index]?.textContent).toContain(stat.value);
      expect(stats[index]?.textContent).toContain(stat.sub);
    }
    const ordered = Array.from(
      doc.querySelectorAll('[data-testid^="signal-node-"], p, [data-testid^="stat-"], img'),
    );
    expect(ordered).toEqual([
      ...doc.querySelectorAll('[data-testid^="signal-node-"]'),
      prose,
      ...stats,
      doc.querySelector('img'),
    ]);
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

  it('exposes a readable section heading and descriptive node headings', async () => {
    const html = renderToStaticMarkup(createElement(GuitarSection));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const section = doc.querySelector('section');
    const heading = doc.getElementById(section?.getAttribute('aria-labelledby') ?? '');
    expect(heading?.textContent).toContain(SECTION_LABELS['sec-guitar']);
    expect(Array.from(doc.querySelectorAll('h3'), (node) => node.textContent)).toEqual(
      guitarPresentation.signalChain.map((node) => node.name),
    );
  });

  it('shows the section name and the terminal command in the header', () => {
    const html = renderToStaticMarkup(createElement(GuitarSection));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const heading = doc.querySelector('h2');
    expect(heading?.textContent).toContain(GUITAR_MODULE_HEADER);
    expect(heading?.querySelector('.module-name')?.textContent).toBe(SECTION_LABELS['sec-guitar']);
  });

  it('renders the live signal chain strip above the chain', async () => {
    const doc = await renderContent();
    const strip = doc.querySelector('.guitar-signal-strip');
    expect(strip?.textContent).toContain(guitarPresentation.signalStrip.live);
    expect(strip?.textContent).toContain(guitarPresentation.signalStrip.tail);
  });

  it('labels every chain node with its role prefix', async () => {
    const doc = await renderContent();
    for (const node of guitarPresentation.signalChain) {
      const displayed = doc.querySelector(`[data-testid="signal-node-${node.role}"]`);
      expect(displayed?.querySelector('.guitar-label')?.textContent).toBe(node.label);
    }
    expect(
      Array.from(doc.querySelectorAll('.guitar-node .guitar-label'), (label) => label.textContent),
    ).toEqual(['// INPUT', '// AMP', '// OUT']);
  });

  it('keeps the mixer inside the guitar and mixer module', () => {
    const html = renderToStaticMarkup(createElement(GuitarSection));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const section = doc.querySelector('section#sec-guitar');
    expect(section).not.toBeNull();
    expect(section?.querySelectorAll('[data-testid="daw-mixer-desktop"]')).toHaveLength(1);
    expect(section?.querySelectorAll('[data-testid^="channel-"]')).toHaveLength(6);
    expect(doc.querySelectorAll('section#sec-daw-mixer')).toHaveLength(0);
  });

  it('sizes the photo for a full-width source up to 767px', async () => {
    const doc = await renderContent();
    expect(doc.querySelector('img')?.getAttribute('sizes')).toBe('(max-width: 767px) 100vw, 320px');
  });
});
