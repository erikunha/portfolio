import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

vi.mock('@/components/client/RoleTyper', () => ({
  RoleTyper: ({ className }: { className?: string }) =>
    createElement('span', { className }, '[Senior]'),
}));

describe('ReadmeSection', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render() {
    const { ReadmeSection } = await import('@/components/sections/ReadmeSection/ReadmeSection');
    mounted = await mountClient(createElement(ReadmeSection));
    return mounted.container;
  }

  it('renders the CAT README.MD module header', async () => {
    const container = await render();
    const heading = container.querySelector('h2');
    expect(heading?.textContent).toContain('CAT README.MD');
  });

  it('renders a line gutter with sequential line numbers', async () => {
    const container = await render();
    const text = container.textContent ?? '';
    expect(text).toContain('1');
  });

  it('renders the GitHub link in the code sample block', async () => {
    const container = await render();
    const githubLink = container.querySelector<HTMLAnchorElement>('a[href*="github.com/erikunha"]');
    expect(githubLink).not.toBeNull();
  });

  it('renders the withRetry code sample', async () => {
    const container = await render();
    expect(container.textContent).toContain('withRetry');
  });

  it('renders the RoleTyper inside the readme content', async () => {
    const container = await render();
    expect(container.textContent).toContain('[Senior]');
  });
});
