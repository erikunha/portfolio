// components/client/InteractiveShell/InteractiveShell.test.tsx
// Merged from:
//   __tests__/InteractiveShell.streaming.test.ts  (streaming behavior)
//   __tests__/shell-aria.test.ts                  (a11y contract)

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

// ── Streaming behavior ────────────────────────────────────────────────────────
//
// Behavioral test (CG3 rewrite, CG4 extension): renders the real
// InteractiveShell, drives a command that routes to /api/ask, and asserts the
// streaming UX through observable DOM — instead of grepping the component
// source for getReader()/TextDecoder.
//
// The guarantees under test:
//   1. Progressive rendering — the answer span appears and grows BEFORE the
//      response stream is fully delivered (a buffered res.text() read would
//      only paint after the last chunk).
//   2. Stable line ids — each history line is rendered under a stable key so
//      React reconciles by identity, not array index. We assert this through
//      the absence of key warnings + correct final ordering after re-renders.
//   3. Streaming chunks are decoded and concatenated correctly.
//   4. (CG4) The streaming line is a React-OWNED feed node — there is no
//      out-of-tree DOM. The previous implementation called
//      `document.createElement('span')` + `feedRef.appendChild` and mutated
//      `textContent` per chunk inside an aria-live region React also owns.
//      This test fails if the implementation reverts to that.

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

// True only if `node` carries the internal fiber key React attaches to every
// DOM node it owns. An out-of-tree `document.createElement` span never has it.
function isReactOwned(node: Element): boolean {
  return Object.keys(node).some((k) => k.startsWith('__reactFiber$'));
}

// Drives a question through the shell form. React controlled input — the value
// must be set via the native setter before the input event so React picks it up.
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

    // Hold the second chunk back so we can observe a mid-stream paint.
    let releaseSecondChunk: () => void = () => {
      /* reassigned by the Promise executor below */
    };
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

    // Submit a question (no local command matches → routes to /api/ask).
    await submitQuestion(container, 'what are your strengths?');
    await flushMicrotasks();
    // The first chunk drives a requestAnimationFrame-coalesced flush; advance
    // one frame so the streaming state commits.
    await flushFrames();

    // Mid-stream: only the first chunk has been emitted. The streaming span
    // must already be in the feed showing partial text — proof of progressive
    // (non-buffered) rendering.
    const feed = container.querySelector('[role="log"]');
    expect(feed?.textContent).toContain('Hello');
    expect(feed?.textContent).not.toContain('world');

    // Release the rest of the stream and let it finalize.
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
    // Stream pull() ticks + the rAF-coalesced flushes both need real frames.
    await flushMicrotasks();
    await flushFrames();
    await flushFrames();

    const feed = container.querySelector('[role="log"]') as HTMLElement;

    // Mid-stream invariant: while the answer is streaming, the live line is a
    // React-owned child of the feed. If the implementation regresses to an
    // out-of-tree `document.createElement` span appended via feedRef, that
    // span carries no __reactFiber$ key and this fails.
    expect(feed.children.length).toBeGreaterThan(0);
    for (const child of Array.from(feed.children)) {
      expect(
        isReactOwned(child),
        `feed child <${child.tagName.toLowerCase()} class="${child.className}"> is not React-owned`,
      ).toBe(true);
    }

    // The streamed text is reassembled correctly into that React node.
    expect(feed.textContent).toContain('Hello from Claude');

    // Let the stream finalize; the answer settles as a permanent history line
    // and every feed child remains React-owned.
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

    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      /* silence expected error output */
    });

    mounted = await mountClient(createElement(InteractiveShell));
    const { container } = mounted;

    await submitQuestion(container, 'a question');
    await flushMicrotasks();
    await flushFrames();
    await flushFrames();

    // React emits a console.error for missing/duplicate keys. None expected.
    const keyWarnings = warnSpy.mock.calls.filter((c) => String(c[0]).includes('unique "key"'));
    expect(keyWarnings).toEqual([]);

    // The prompt echo and the answer both survive as distinct feed lines —
    // index-based keys would have collapsed/duplicated under the loading-line
    // removal that happens mid-stream.
    const feed = container.querySelector('[role="log"]');
    expect(feed?.textContent).toContain('a question');
    expect(feed?.textContent).toContain('final answer');

    warnSpy.mockRestore();
  });
});

// ── Shell feed accessibility ──────────────────────────────────────────────────
//
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
    // jsdom serializes the boolean attribute; idle shell is not busy.
    expect(feed?.getAttribute('aria-busy')).toBe('false');
  });

  it('the loading indicator is rendered aria-hidden while a response streams', async () => {
    // Hold the fetch open so the loading line stays in the DOM long enough to
    // assert on it.
    let release: () => void = () => {
      /* reassigned by the Promise executor below */
    };
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

    // While the request is in flight: feed is busy + the loading dots line
    // (decorative animation) is aria-hidden so AT doesn't announce '...'.
    const feed = container.querySelector('[role="log"]');
    expect(feed?.getAttribute('aria-busy')).toBe('true');
    const loading = container.querySelector('[data-testid="shell-line-loading"]');
    expect(loading).not.toBeNull();
    expect(loading?.getAttribute('aria-hidden')).toBe('true');

    release();
    await flushMicrotasks();
  });
});

// ─── Multi-turn history ───────────────────────────────────────────────────────
// Locks down: a second question appends a new answer to the history log rather
// than replacing or clobbering the first answer.

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
