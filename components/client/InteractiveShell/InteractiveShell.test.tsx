import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  flushFrames,
  flushMicrotasks,
  type MountedClient,
  mountClient,
} from '@/__tests__/helpers/render';

vi.mock('@/lib/use-breakpoint.client', () => ({
  useBreakpoint: () => ({ isMobile: false }),
}));

vi.mock('@/lib/motion', () => ({
  readMotion: () => false,
}));

vi.mock('@/content/shell-commands', () => ({
  default: [],
}));

function streamingResponse(chunks: string[]): Response {
  const enc = new TextEncoder();
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(enc.encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function isReactOwned(node: Element): boolean {
  return Object.keys(node).some((k) => k.startsWith('__reactFiber$'));
}

function submitQuestion(container: HTMLElement, question: string): Promise<void> {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="shell command"]');
  const form = container.querySelector<HTMLFormElement>('form');
  expect(input).not.toBeNull();
  expect(form).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  return act(async () => {
    if (input && setter) setter.call(input, question);
    input?.dispatchEvent(new Event('input', { bubbles: true }));
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

describe('InteractiveShell streaming behavior', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  it('renders the answer progressively as the /api/ask stream arrives', async () => {
    const { InteractiveShell } = await import('./InteractiveShell');

    let releaseSecondChunk: () => void = () => undefined;
    const secondChunkGate = new Promise<void>((r) => {
      releaseSecondChunk = r;
    });
    const enc = new TextEncoder();
    const gatedBody = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(enc.encode('Hello'));
        await secondChunkGate;
        controller.enqueue(enc.encode(' world'));
        controller.close();
      },
    });
    const fetchMock = vi.fn(
      async () =>
        new Response(gatedBody, { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    mounted = await mountClient(createElement(InteractiveShell));
    const { container } = mounted;

    await submitQuestion(container, 'what are your strengths?');
    await flushMicrotasks();
    await flushFrames();

    const feed = container.querySelector('[role="log"]');
    expect(feed?.textContent).toContain('Hello');
    expect(feed?.textContent).not.toContain('world');

    releaseSecondChunk();
    await flushMicrotasks();
    await flushFrames();

    expect(fetchMock).toHaveBeenCalledWith('/api/ask', expect.objectContaining({ method: 'POST' }));
    expect(feed?.textContent).toContain('Hello world');
  });

  it('renders streamed text into a React-owned feed node — no out-of-tree DOM', async () => {
    const { InteractiveShell } = await import('./InteractiveShell');

    const fetchMock = vi.fn(async () => streamingResponse(['Hello ', 'from ', 'Claude']));
    vi.stubGlobal('fetch', fetchMock);

    mounted = await mountClient(createElement(InteractiveShell));
    const { container } = mounted;

    await submitQuestion(container, 'who are you');
    await flushMicrotasks();
    await flushFrames();
    await flushFrames();

    const feed = container.querySelector('[role="log"]') as HTMLElement;

    expect(feed.children.length).toBeGreaterThan(0);
    for (const child of Array.from(feed.children)) {
      expect(
        isReactOwned(child),
        `feed child <${child.tagName.toLowerCase()} class="${child.className}"> is not React-owned`,
      ).toBe(true);
    }

    expect(feed.textContent).toContain('Hello from Claude');

    await flushMicrotasks();
    await flushFrames();
    expect(feed.textContent).toContain('Hello from Claude');
    for (const child of Array.from(feed.children)) {
      expect(isReactOwned(child)).toBe(true);
    }
  });

  it('keys history lines stably so reconciliation does not collapse them', async () => {
    const { InteractiveShell } = await import('./InteractiveShell');

    const fetchMock = vi.fn(async () => streamingResponse(['final answer']));
    vi.stubGlobal('fetch', fetchMock);

    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mounted = await mountClient(createElement(InteractiveShell));
    const { container } = mounted;

    await submitQuestion(container, 'a question');
    await flushMicrotasks();
    await flushFrames();
    await flushFrames();

    const keyWarnings = warnSpy.mock.calls.filter((c) => String(c[0]).includes('unique "key"'));
    expect(keyWarnings).toEqual([]);

    const feed = container.querySelector('[role="log"]');
    expect(feed?.textContent).toContain('a question');
    expect(feed?.textContent).toContain('final answer');

    warnSpy.mockRestore();
  });
});

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
    const { InteractiveShell } = await import('./InteractiveShell');
    mounted = await mountClient(createElement(InteractiveShell));
    return mounted.container;
  }

  it('the shell feed is a labelled live region', async () => {
    const container = await renderShell();
    const feed = container.querySelector('[role="log"]');
    expect(feed).not.toBeNull();
    expect(feed?.getAttribute('role')).toBe('log');
    expect(feed?.getAttribute('aria-label')).toBe('shell output');
    expect(feed?.getAttribute('aria-live')).toBe('polite');
  });

  it('the feed exposes aria-busy (false while idle)', async () => {
    const container = await renderShell();
    const feed = container.querySelector('[role="log"]');
    expect(feed?.getAttribute('aria-busy')).toBe('false');
  });

  it('the loading indicator is rendered aria-hidden while a response streams', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const fetchMock = vi.fn(async () => {
      await gate;
      return new Response('answer', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const container = await renderShell();

    const input = container.querySelector<HTMLInputElement>('input[aria-label="shell command"]');
    const form = container.querySelector<HTMLFormElement>('form');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      if (input && setter) setter.call(input, 'a question');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();

    const feed = container.querySelector('[role="log"]');
    expect(feed?.getAttribute('aria-busy')).toBe('true');
    const loading = container.querySelector('[data-testid="shell-line-loading"]');
    expect(loading).not.toBeNull();
    expect(loading?.getAttribute('aria-hidden')).toBe('true');

    release();
    await flushMicrotasks();
  });
});

describe('InteractiveShell — multi-turn history', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  it('appends the second answer below the first in the log feed', async () => {
    let callCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        callCount++;
        const answer = callCount === 1 ? 'First answer.' : 'Second answer.';
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(answer));
            controller.close();
          },
        });
        return new Response(stream, { status: 200 });
      }),
    );

    const { InteractiveShell } = await import('./InteractiveShell');
    mounted = await mountClient(createElement(InteractiveShell));
    const { container } = mounted;

    await submitQuestion(container, 'first question');
    await flushMicrotasks();
    await flushFrames();
    await flushFrames();

    await submitQuestion(container, 'second question');
    await flushMicrotasks();
    await flushFrames();
    await flushFrames();

    const log = container.querySelector('[role="log"]');
    const text = log?.textContent ?? '';
    expect(text).toContain('First answer.');
    expect(text).toContain('Second answer.');
    const firstIdx = text.indexOf('First answer.');
    const secondIdx = text.indexOf('Second answer.');
    expect(firstIdx).toBeLessThan(secondIdx);
  });
});
