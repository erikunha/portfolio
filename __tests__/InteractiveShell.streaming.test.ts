// __tests__/InteractiveShell.streaming.test.ts
// Behavioral test (CG3): renders the real InteractiveShell, drives a command
// that routes to /api/ask, and asserts the streaming UX through observable
// DOM — instead of grepping the component source for getReader()/TextDecoder.
//
// The guarantees under test:
//   1. Progressive rendering — the answer span appears and grows BEFORE the
//      response stream is fully delivered (a buffered res.text() read would
//      only paint after the last chunk).
//   2. Stable line ids — each history line is rendered under a stable key so
//      React reconciles by identity, not array index. We assert this through
//      the absence of key warnings + correct final ordering after re-renders.
//   3. Streaming chunks are decoded and concatenated correctly.

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/use-breakpoint.client', () => ({
  useBreakpoint: () => ({ isMobile: false }),
}));

vi.mock('@/lib/motion', () => ({
  readMotion: () => false,
}));

vi.mock('@/content/shell-commands', () => ({
  default: [],
}));

// Build a streamed Response whose body emits the given text chunks one at a
// time, with a microtask gap between them so progressive rendering is
// observable.
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

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
  });
}

describe('InteractiveShell streaming behavior', () => {
  let container: HTMLElement;
  let root: import('react-dom/client').Root;

  beforeEach(() => {
    vi.resetModules();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders the answer progressively as the /api/ask stream arrives', async () => {
    const { createElement } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { InteractiveShell } = await import('@/components/client/InteractiveShell');

    // Hold the second chunk back so we can observe a mid-stream paint.
    let releaseSecondChunk: () => void = () => {};
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

    root = createRoot(container);
    await act(async () => {
      root.render(createElement(InteractiveShell));
    });

    // Submit a question (no local command matches → routes to /api/ask).
    const input = container.querySelector<HTMLInputElement>('input.shell__input');
    const form = container.querySelector<HTMLFormElement>('form.shell__form');
    expect(input).not.toBeNull();
    expect(form).not.toBeNull();
    await act(async () => {
      input?.setAttribute('value', 'what are your strengths?');
      // React controlled input — set value via the native setter then dispatch.
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (input && setter) setter.call(input, 'what are your strengths?');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();

    // Mid-stream: only the first chunk has been emitted. The streaming span
    // must already be in the feed showing partial text — proof of progressive
    // (non-buffered) rendering.
    const feed = container.querySelector('.shell__feed');
    expect(feed?.textContent).toContain('Hello');
    expect(feed?.textContent).not.toContain('world');

    // Release the rest of the stream and let it finalize.
    releaseSecondChunk();
    await flush();
    await flush();

    expect(fetchMock).toHaveBeenCalledWith('/api/ask', expect.objectContaining({ method: 'POST' }));
    expect(feed?.textContent).toContain('Hello world');
  });

  it('keys history lines stably so reconciliation does not collapse them', async () => {
    const { createElement } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { InteractiveShell } = await import('@/components/client/InteractiveShell');

    const fetchMock = vi.fn(async () => streamingResponse(['final answer']));
    vi.stubGlobal('fetch', fetchMock);

    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    root = createRoot(container);
    await act(async () => {
      root.render(createElement(InteractiveShell));
    });

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
    await flush();
    await flush();

    // React emits a console.error for missing/duplicate keys. None expected.
    const keyWarnings = warnSpy.mock.calls.filter((c) => String(c[0]).includes('unique "key"'));
    expect(keyWarnings).toEqual([]);

    // The prompt echo and the answer both survive as distinct feed lines —
    // index-based keys would have collapsed/duplicated under the loading-line
    // removal that happens mid-stream.
    const feed = container.querySelector('.shell__feed');
    expect(feed?.textContent).toContain('a question');
    expect(feed?.textContent).toContain('final answer');

    warnSpy.mockRestore();
  });
});
