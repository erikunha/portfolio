import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

describe('ComponentNav', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render() {
    const { ComponentNav } = await import(
      '@/app/design-system/_components/ComponentNav/ComponentNav'
    );
    mounted = await mountClient(createElement(ComponentNav));
    return mounted.container;
  }

  it('renders a nav with "Jump to component" aria-label', async () => {
    const container = await render();
    const nav = container.querySelector('nav[aria-label="Jump to component"]');
    expect(nav).not.toBeNull();
  });

  it('renders a link for the Button component', async () => {
    const container = await render();
    const buttonLink = container.querySelector<HTMLAnchorElement>('a[href="#button"]');
    expect(buttonLink).not.toBeNull();
    expect(buttonLink?.textContent).toBe('Button');
  });

  it('renders links for all expected component entries', async () => {
    const container = await render();
    const links = container.querySelectorAll('a[href^="#"]');
    expect(links.length).toBeGreaterThanOrEqual(8);
  });

  it('renders hash fragment hrefs for all links', async () => {
    const container = await render();
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    for (const link of links) {
      expect(link.getAttribute('href')).toMatch(/^#/);
    }
  });
});
