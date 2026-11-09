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
      '@/app/(en)/design-system/_components/ComponentNav/ComponentNav'
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

  it('links every component section and nothing else', async () => {
    const container = await render();
    const hrefs = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')).map(
      (link) => link.getAttribute('href'),
    );
    expect(hrefs).toEqual([
      '#button',
      '#field',
      '#badge',
      '#brand-icon',
      '#window-chrome',
      '#terminal-panel',
      '#stat-tile',
      '#cmd-line',
      '#kbd-key',
      '#nav-item',
      '#copybutton',
      '#panel',
      '#menu-trigger',
      '#position-line',
      '#eq-spectrum-strip',
      '#cover-frame',
      '#company-link',
    ]);
  });

  it('renders hash fragment hrefs for all links', async () => {
    const container = await render();
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'));
    for (const link of links) {
      expect(link.getAttribute('href')).toMatch(/^#/);
    }
  });
});
