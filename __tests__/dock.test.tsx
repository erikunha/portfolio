import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

describe('Dock', () => {
  let mounted: MountedClient;
  let scrolledIntoView: Element | null = null;

  beforeEach(() => {
    scrolledIntoView = null;

    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolledIntoView = this;
    });
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  async function render() {
    const { Dock } = await import('@/components/responsive/Dock/Dock.client');
    mounted = await mountClient(createElement(Dock));
    return mounted.container;
  }

  it('renders a nav with primary label', async () => {
    const container = await render();
    const nav = container.querySelector('nav[aria-label="primary"]');
    expect(nav).not.toBeNull();
  });

  it('renders links for all expected dock items', async () => {
    const container = await render();
    const links = container.querySelectorAll('a');
    expect(links.length).toBeGreaterThanOrEqual(6);
  });

  it('renders the DS link pointing to /design-system (external href)', async () => {
    const container = await render();
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    const dsLink = links.find((a) => a.href.includes('/design-system'));
    expect(dsLink).not.toBeNull();
  });

  it('clicking a hash link prevents default and scrolls to target', async () => {
    const container = await render();

    const targetSection = document.createElement('section');
    targetSection.id = 'sec-readme';
    document.body.appendChild(targetSection);

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    const homeLink = links.find((a) => a.getAttribute('href') === '#sec-readme');
    expect(homeLink).not.toBeNull();

    let defaultPrevented = false;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'preventDefault', {
      value: () => {
        defaultPrevented = true;
      },
    });

    await act(async () => {
      homeLink?.dispatchEvent(event);
    });

    expect(defaultPrevented).toBe(true);
    expect(scrolledIntoView).toBe(targetSection);

    document.body.removeChild(targetSection);
  });

  it('does not call scrollIntoView when the target element is missing from DOM', async () => {
    const container = await render();

    document.getElementById('sec-readme')?.remove();

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    const homeLink = links.find((a) => a.getAttribute('href') === '#sec-readme');

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      homeLink?.dispatchEvent(event);
    });

    expect(scrolledIntoView).toBeNull();
  });

  it('does not prevent default for non-hash links (e.g. /design-system)', async () => {
    const container = await render();
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    const dsLink = links.find((a) => a.getAttribute('href') === '/design-system');
    expect(dsLink).not.toBeNull();

    let defaultPrevented = false;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'preventDefault', {
      value: () => {
        defaultPrevented = true;
      },
    });

    await act(async () => {
      dsLink?.dispatchEvent(event);
    });

    expect(defaultPrevented).toBe(false);
  });
});
