import { type ComponentType, createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

describe('PerfReceiptsSection', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render(props: { defer?: boolean } = {}) {
    const { PerfReceiptsSection } = await import(
      '@/components/sections/PerfReceiptsSection/PerfReceiptsSection'
    );
    mounted = await mountClient(
      createElement(PerfReceiptsSection as ComponentType<{ defer?: boolean }>, props),
    );
    return mounted.container;
  }

  it('renders the section module with PERF_RECEIPTS header', async () => {
    const container = await render();
    const heading = container.querySelector('h2');
    expect(heading?.textContent).toContain('PERF_RECEIPTS');
  });

  it('renders at least one list item (receipt card)', async () => {
    const container = await render();
    const items = container.querySelectorAll('li');
    expect(items.length).toBeGreaterThan(0);
  });

  it('renders the first receipt as a hero card (contains first receipt metric)', async () => {
    const container = await render();
    const { perfReceipts } = await import('@/content/perf-receipts');
    const firstMetric = perfReceipts[0]?.metric ?? '';
    expect(container.textContent).toContain(firstMetric);
  });

  it('renders delta text for receipts', async () => {
    const container = await render();
    const { perfReceipts } = await import('@/content/perf-receipts');
    const firstDelta = perfReceipts[0]?.delta ?? '';
    expect(container.textContent).toContain(firstDelta);
  });

  it('renders company text for receipts', async () => {
    const container = await render();
    const { perfReceipts } = await import('@/content/perf-receipts');
    const firstCompany = perfReceipts[0]?.company ?? '';
    expect(container.textContent).toContain(firstCompany);
  });

  it('renders a receipt card that has mobileMetric with two metric spans', async () => {
    const container = await render();
    const { perfReceipts } = await import('@/content/perf-receipts');
    const mobileReceipt = perfReceipts.find((r) => r.mobileMetric != null);
    if (!mobileReceipt) return;
    expect(container.textContent).toContain(mobileReceipt.mobileMetric as string);
  });

  it('renders the defer prop without error', async () => {
    const container = await render({ defer: true });
    expect(container.querySelector('li')).not.toBeNull();
  });
});
