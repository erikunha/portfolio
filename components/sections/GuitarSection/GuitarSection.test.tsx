import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement('img', { src, alt }),
}));

async function renderDesktop(): Promise<Document> {
  const { GuitarDesktop } = await import('./GuitarSection');
  const html = renderToStaticMarkup(createElement(GuitarDesktop));
  return new DOMParser().parseFromString(html, 'text/html');
}

async function renderMobile(): Promise<Document> {
  const { GuitarMobile } = await import('./GuitarSection');
  const html = renderToStaticMarkup(createElement(GuitarMobile));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('GuitarSection — signal chain (desktop)', () => {
  it('renders all 4 signal chain nodes', async () => {
    const doc = await renderDesktop();
    expect(doc.querySelectorAll('[data-testid^="signal-node-"]').length).toBe(4);
  });

  it('renders INPUT, FX, AMP, OUT nodes', async () => {
    const doc = await renderDesktop();
    for (const role of ['INPUT', 'FX', 'AMP', 'OUT']) {
      expect(doc.querySelector(`[data-testid="signal-node-${role}"]`)).not.toBeNull();
    }
  });

  it('FX node renders 5 active block bullets', async () => {
    const doc = await renderDesktop();
    const fxNode = doc.querySelector('[data-testid="signal-node-FX"]');
    expect(fxNode).not.toBeNull();
    const bullets = fxNode?.querySelectorAll('[data-testid="fx-bullet"]');
    expect(bullets?.length).toBe(5);
  });

  it('INPUT node shows 4 strength dots', async () => {
    const doc = await renderDesktop();
    const inputNode = doc.querySelector('[data-testid="signal-node-INPUT"]');
    expect(inputNode?.querySelector('[aria-label="4 of 8"]')).not.toBeNull();
  });
});

describe('GuitarSection — influences (desktop)', () => {
  it('renders INFLUENCES.QUEUE header with 5 loaded', async () => {
    const doc = await renderDesktop();
    expect(doc.body.textContent).toContain('INFLUENCES.QUEUE · 5 LOADED');
  });

  it('renders John Mayer as the active (▶) influence', async () => {
    const doc = await renderDesktop();
    const active = doc.querySelector('[data-testid="guitar-desktop"] [data-active]');
    expect(active?.textContent).toContain('John Mayer');
  });

  it('renders now obsessing text', async () => {
    const doc = await renderDesktop();
    expect(doc.body.textContent).toContain('simplicity is hard');
  });
});

describe('GuitarSection — stats grid (desktop)', () => {
  it('renders 4 stat cells', async () => {
    const doc = await renderDesktop();
    expect(doc.querySelectorAll('[data-testid^="stat-"]').length).toBe(4);
  });

  it('stat labels are STYLE, TUNING, ALT RIG, GIGS', async () => {
    const doc = await renderDesktop();
    for (const label of ['STYLE', 'TUNING', 'ALT RIG', 'GIGS']) {
      expect(doc.querySelector(`[data-testid="stat-${label}"]`)).not.toBeNull();
    }
  });
});

describe('GuitarSection — live cam (desktop)', () => {
  it('renders image with descriptive alt text', async () => {
    const doc = await renderDesktop();
    const img = doc.querySelector('img');
    expect(img?.getAttribute('alt')).toContain('Erik playing guitar');
  });

  it('renders the gig caption', async () => {
    const doc = await renderDesktop();
    expect(doc.body.textContent).toContain('FEEL OVER NOISE');
  });
});

describe('GuitarSection — mobile layout', () => {
  it('renders all 4 signal chain nodes on mobile', async () => {
    const doc = await renderMobile();
    expect(doc.querySelectorAll('[data-testid^="signal-node-mobile-"]').length).toBe(4);
  });

  it('FX node renders blocks as a list (not a grid)', async () => {
    const doc = await renderMobile();
    const fxNode = doc.querySelector('[data-testid="signal-node-mobile-FX"]');
    expect(fxNode).not.toBeNull();
    const list = fxNode?.querySelector('[data-testid="fx-list"]');
    expect(list).not.toBeNull();
  });

  it('mobile stats renders 4 cells in a 2x2 grid', async () => {
    const doc = await renderMobile();
    expect(doc.querySelectorAll('[data-testid^="stat-mobile-"]').length).toBe(4);
  });
});

describe('GuitarSection — XSS safety', () => {
  it('renders node labels as plain text with no injected HTML', async () => {
    const doc = await renderDesktop();
    expect(doc.querySelectorAll('script').length).toBe(0);
    const nodeLabels = doc.querySelectorAll('[data-testid="node-label"]');
    expect(nodeLabels.length).toBeGreaterThan(0);
    for (const node of nodeLabels) {
      expect(node.innerHTML).not.toMatch(/<(?!br|strong|em)/);
    }
  });
});
