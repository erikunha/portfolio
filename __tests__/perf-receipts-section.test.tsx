import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { projectReceipts, receiptsHeading } from '@/content/perf-receipts';
import { type MountedClient, mountClient } from './helpers/render';

describe('Projects nested performance receipts', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render() {
    const { ProjectsSection } = await import('@/components/sections/ProjectsSection');
    mounted = await mountClient(createElement(ProjectsSection));
    return mounted.container;
  }

  it('renders the receipts heading inside the single Projects module', async () => {
    const container = await render();
    expect(container.querySelector('#sec-projects .project-receipts h3')?.textContent).toBe(
      receiptsHeading,
    );
    expect(container.querySelectorAll('section')).toHaveLength(1);
    expect(container.querySelector('.project-receipts section')).toBeNull();
  });

  it('renders exactly the six selected receipts in canonical order', async () => {
    const container = await render();
    const items = Array.from(container.querySelectorAll('.project-receipts li'));
    expect(items).toHaveLength(6);
    expect(items.map((item) => item.querySelector('[data-receipt-metric]')?.textContent)).toEqual(
      projectReceipts.map((receipt) => receipt.metric),
    );
  });

  it('features only the first receipt and its canonical display value', async () => {
    const container = await render();
    const featured = container.querySelectorAll('[data-featured]');
    expect(featured).toHaveLength(1);
    expect(featured[0]?.closest('li')?.textContent).toContain(projectReceipts[0]?.metric);
    expect(featured[0]?.textContent).toBe(
      projectReceipts[0]?.displayValue ?? projectReceipts[0]?.delta,
    );
  });

  it('renders display values or deltas from canonical content for every receipt', async () => {
    const container = await render();
    const values = Array.from(container.querySelectorAll('.project-receipts [data-delta]'));
    expect(values.map((value) => value.textContent)).toEqual(
      projectReceipts.map((receipt) => receipt.displayValue ?? receipt.delta),
    );
  });

  it('renders the company and context from content for every receipt', async () => {
    const container = await render();
    const items = Array.from(container.querySelectorAll('.project-receipts li'));
    expect(items.map((item) => item.querySelector('.receipt-company')?.textContent)).toEqual(
      projectReceipts.map((receipt) => receipt.company),
    );
    expect(items.map((item) => item.querySelector('.receipt-context')?.textContent)).toEqual(
      projectReceipts.map((receipt) => receipt.note),
    );
  });

  it('keeps the receipts anchor nested below the project cards', async () => {
    const container = await render();
    const cards = container.querySelector('#sec-projects .projects-grid');
    expect(cards).not.toBeNull();
    const receipts = cards?.nextElementSibling;
    expect(receipts?.classList.contains('project-receipts')).toBe(true);
    expect(receipts?.querySelector('#sec-perf-receipts')?.tagName).toBe('H3');
  });
});
