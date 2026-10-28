import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { guitarPresentation, guitarRig } from '@/content/guitar-rig';
import { SECTION_LABELS } from '@/content/section-labels';
import { GuitarContent, GuitarSection } from './GuitarSection';

vi.mock('@/lib/ua', () => ({ getIsMobile: vi.fn().mockResolvedValue(false) }));

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
    const displayedLabels = Array.from(
      doc.querySelectorAll('div, span'),
      (node) => node.textContent,
    );
    for (const block of guitarRig.signalChain[1].blocks) {
      expect(displayedLabels).not.toContain(block.name);
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
});
