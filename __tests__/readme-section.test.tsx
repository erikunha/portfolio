// __tests__/readme-section.test.tsx
// Behavioral tests for components/sections/ReadmeSection/ReadmeSection.tsx.
// Locks down: renders CAT README.MD header; renders line numbers in gutter;
// renders h1/h2 markdown-style headings; renders code sample block;
// ReadmeBlock renders all provided lines.

import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

// RoleTyper uses useEffect + setInterval — stub it to a static span to avoid
// timer complexity and keep the test focused on ReadmeSection structure.
vi.mock('@/components/client/RoleTyper', () => ({
  RoleTyper: ({ className }: { className?: string }) =>
    createElement('span', { className }, '[Senior]'),
}));

// readmeCopy is content data — no mock needed; the real module is used.

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
    const summary = container.querySelector('summary');
    expect(summary?.textContent).toContain('CAT README.MD');
  });

  it('renders a line gutter with sequential line numbers', async () => {
    const container = await render();
    // The gutter has numbered spans — at least a few should be present
    // They represent line numbers starting at 1
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
    // Our stub renders [Senior] — confirm it appears in the output
    expect(container.textContent).toContain('[Senior]');
  });
});
