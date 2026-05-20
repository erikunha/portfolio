// __tests__/shell-aria.test.ts
// Behavioral test (CG3): renders the real InteractiveShell and queries the
// committed DOM for its accessibility contract, instead of grepping the
// component source for aria-* string literals.
//
// Guarantees under test:
//   - the shell feed is a labelled live region (role=log, aria-label) so a
//     screen reader announces streamed output;
//   - the feed exposes aria-busy so AT knows when a response is in flight;
//   - the animated loading indicator is aria-hidden (decorative, must not be
//     read out character-by-character).

import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, type MountedClient, mountClient } from './helpers/render';

vi.mock('@/lib/use-breakpoint.client', () => ({
  useBreakpoint: () => ({ isMobile: false }),
}));

vi.mock('@/lib/motion', () => ({
  readMotion: () => false,
}));

vi.mock('@/content/shell-commands', () => ({
  default: [],
}));

describe('shell feed accessibility', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  async function renderShell(): Promise<HTMLElement> {
    const { InteractiveShell } = await import('@/components/client/InteractiveShell');
    mounted = await mountClient(createElement(InteractiveShell));
    return mounted.container;
  }

  it('the shell feed is a labelled live region', async () => {
    const container = await renderShell();
    const feed = container.querySelector('.shell__feed');
    expect(feed).not.toBeNull();
    expect(feed?.getAttribute('role')).toBe('log');
    expect(feed?.getAttribute('aria-label')).toBe('shell output');
    expect(feed?.getAttribute('aria-live')).toBe('polite');
  });

  it('the feed exposes aria-busy (false while idle)', async () => {
    const container = await renderShell();
    const feed = container.querySelector('.shell__feed');
    // jsdom serializes the boolean attribute; idle shell is not busy.
    expect(feed?.getAttribute('aria-busy')).toBe('false');
  });

  it('the loading indicator is rendered aria-hidden while a response streams', async () => {
    // Hold the fetch open so the loading line stays in the DOM long enough to
    // assert on it.
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const fetchMock = vi.fn(async () => {
      await gate;
      return new Response('answer', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const container = await renderShell();

    const input = container.querySelector<HTMLInputElement>('input.shell__input');
    const form = container.querySelector<HTMLFormElement>('form.shell__form');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      if (input && setter) setter.call(input, 'a question');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();

    // While the request is in flight: feed is busy + the loading dots line
    // (decorative animation) is aria-hidden so AT doesn't announce '...'.
    const feed = container.querySelector('.shell__feed');
    expect(feed?.getAttribute('aria-busy')).toBe('true');
    const loading = container.querySelector('.shell__line--loading');
    expect(loading).not.toBeNull();
    expect(loading?.getAttribute('aria-hidden')).toBe('true');

    release();
    await flushMicrotasks();
  });
});
