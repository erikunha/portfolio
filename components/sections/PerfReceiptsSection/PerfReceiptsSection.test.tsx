import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { perfReceipts } from '@/content/perf-receipts';
import { ProjectsSection } from '../ProjectsSection/ProjectsSection';

async function renderSection(): Promise<Document> {
  const { PerfReceiptsSection } = await import('./PerfReceiptsSection');
  const html = renderToStaticMarkup(createElement(PerfReceiptsSection));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('PerfReceiptsSection — hero data-featured variant', () => {
  it('adds data-featured attribute to the hero delta value', async () => {
    const doc = await renderSection();
    const featured = doc.querySelector('[data-featured]');
    expect(featured).not.toBeNull();
  });

  it('renders exactly one element with data-featured', async () => {
    const doc = await renderSection();
    const featured = doc.querySelectorAll('[data-featured]');
    expect(featured.length).toBe(1);
  });

  it('non-hero delta elements do not carry data-featured', async () => {
    const doc = await renderSection();
    const nonFeaturedDeltas = doc.querySelectorAll('[data-delta]:not([data-featured])');
    expect(nonFeaturedDeltas.length).toBeGreaterThan(0);
  });
});

describe('performance receipts attached to Projects', () => {
  it('nests six non-repeated receipts in Projects with a subordinate heading', () => {
    const doc = new DOMParser().parseFromString(
      renderToStaticMarkup(createElement(ProjectsSection)),
      'text/html',
    );
    const attachment = doc.querySelector('#sec-projects #sec-perf-receipts');
    expect(attachment).not.toBeNull();
    expect(attachment?.querySelector('h3')?.textContent).toContain('PERF_RECEIPTS');
    expect(
      [...(attachment?.querySelectorAll('[data-receipt]') ?? [])].map((row) =>
        row.getAttribute('data-receipt'),
      ),
    ).toEqual(['API_LATENCY', 'BUNDLE_CSS', 'INITIAL_LOAD', 'CONVERSION', 'DESKTOP_BUILD', 'LCP']);
    expect(attachment?.textContent).not.toContain('ONBOARDING_TIME');
  });

  it('shows the approved before/after figures and the canonical percentage without invented measurements', async () => {
    const doc = await renderSection();
    expect(doc.querySelector('[data-receipt="API_LATENCY"]')?.textContent).toContain('40s→<1s');
    expect(doc.querySelector('[data-receipt="LCP"]')?.textContent).toContain('2,544→1,308ms');
    for (const row of doc.querySelectorAll('[data-receipt]')) {
      const receipt = perfReceipts.find((r) => r.metric === row.getAttribute('data-receipt'));
      expect(row.textContent).toContain(receipt?.delta);
      expect(row.textContent).toContain(receipt?.company);
      expect(row.textContent).toContain(receipt?.note);
    }
  });

  it('links company evidence to the matching project without assigning Venturus to another company', () => {
    const doc = new DOMParser().parseFromString(
      renderToStaticMarkup(createElement(ProjectsSection)),
      'text/html',
    );
    const targets = {
      BUNDLE_CSS: 'Canon Medical Systems',
      INITIAL_LOAD: 'Canon Medical Systems',
      CONVERSION: 'Grupo SBF (Nike / Centauro)',
      DESKTOP_BUILD: 'MB Labs',
      LCP: 'Raylu',
    };
    for (const [metric, company] of Object.entries(targets)) {
      const href = doc.querySelector(`[data-receipt="${metric}"] a`)?.getAttribute('href');
      expect(href).toMatch(/^#project-/);
      expect(doc.querySelector(href ?? '')?.querySelector('.project-co')?.textContent).toContain(
        company,
      );
    }
    expect(doc.querySelector('[data-receipt="API_LATENCY"] a')).toBeNull();
  });
});
