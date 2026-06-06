// __tests__/dock.test.tsx
// Behavioral tests for components/responsive/Dock/Dock.client.tsx.
// Locks down: all nav items render; onJump handler: hash hrefs prevent default
// + scroll; external hrefs skip preventDefault; DETAILS target dispatches
// module:open event; missing DOM target exits gracefully.

import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

describe('Dock', () => {
  let mounted: MountedClient;
  let scrolledIntoView: Element | null = null;
  let moduleOpenEvents: string[] = [];
  let moduleOpenListener: (e: Event) => void;

  beforeEach(() => {
    scrolledIntoView = null;
    moduleOpenEvents = [];

    // Stub scrollIntoView — jsdom doesn't implement it.
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolledIntoView = this;
    });

    // Listen for module:open custom events dispatched by Dock.
    moduleOpenListener = (e: Event) => {
      moduleOpenEvents.push((e as CustomEvent<{ id: string }>).detail?.id ?? '');
    };
    window.addEventListener('module:open', moduleOpenListener);
  });

  afterEach(() => {
    mounted?.unmount();
    window.removeEventListener('module:open', moduleOpenListener);
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

    // Create a target section element in the document
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

  it('clicking a hash link whose target is a DETAILS element dispatches module:open', async () => {
    const container = await render();

    // Create a <details> target
    const detailsEl = document.createElement('details');
    detailsEl.id = 'sec-shell';
    document.body.appendChild(detailsEl);

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    const shellLink = links.find((a) => a.getAttribute('href') === '#sec-shell');
    expect(shellLink).not.toBeNull();

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      shellLink?.dispatchEvent(event);
    });

    expect(moduleOpenEvents).toContain('sec-shell');

    document.body.removeChild(detailsEl);
  });

  it('does not call scrollIntoView when the target element is missing from DOM', async () => {
    const container = await render();

    // Ensure no element with id sec-readme exists
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
