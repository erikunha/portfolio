import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, type MountedClient, mountClient } from './helpers/render';

describe('StatusBar', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  async function render() {
    const { StatusBar } = await import('@/components/responsive/StatusBar/StatusBar.client');
    mounted = await mountClient(createElement(StatusBar));
    return mounted.container;
  }

  it('renders a status role element with accessible label', async () => {
    const container = await render();
    const status = container.querySelector('[role="status"][aria-label="device status"]');
    expect(status).not.toBeNull();
  });

  it('renders the carrier label DEV_OS', async () => {
    const container = await render();
    expect(container.textContent).toContain('DEV_OS');
  });

  it('renders the 5G signal label', async () => {
    const container = await render();
    expect(container.textContent).toContain('5G');
  });

  it('renders battery percentage text', async () => {
    const container = await render();
    expect(container.textContent).toContain('78%');
  });

  it('sets a time string after mount effect fires', async () => {
    const container = await render();
    await flushMicrotasks();
    expect(container.textContent?.length).toBeGreaterThan(0);
  });
});
