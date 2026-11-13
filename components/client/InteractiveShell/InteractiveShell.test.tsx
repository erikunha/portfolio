import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fire,
  flushFrames,
  flushMicrotasks,
  type MountedClient,
  mountClient,
} from '@/__tests__/helpers/render';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { shellChrome } from '@/content/terminal-chrome';

const mobileViewport = vi.hoisted(() => ({ value: false }));
vi.mock('@/lib/use-breakpoint.client', () => ({
  useBreakpoint: () => ({ isMobile: mobileViewport.value }),
}));

vi.mock('@/lib/motion', () => ({
  readMotion: () => false,
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

async function submitQuestion(container: HTMLElement, question: string): Promise<void> {
  const input = container.querySelector<HTMLInputElement>('input[name="command"]');
  const form = container.querySelector<HTMLFormElement>('form');
  expect(input).not.toBeNull();
  expect(form).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    if (input && setter) setter.call(input, question);
    fire(input, new Event('input', { bubbles: true }));
  });
  await act(async () => {
    fire(form, new Event('submit', { bubbles: true, cancelable: true }));
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
    vi.unstubAllGlobals();
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

    mounted = await mountClient(
      createElement(InteractiveShell, {
        locale: SITE_LOCALE.en,
        ui: shellUi[SITE_LOCALE.en],
        chrome: shellChrome[SITE_LOCALE.en],
      }),
    );
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

  it('renders streamed text into a React-owned feed node without out-of-tree DOM', async () => {
    const { InteractiveShell } = await import('./InteractiveShell');

    const fetchMock = vi.fn(async () => streamingResponse(['Hello ', 'from ', 'Claude']));
    vi.stubGlobal('fetch', fetchMock);

    mounted = await mountClient(
      createElement(InteractiveShell, {
        locale: SITE_LOCALE.en,
        ui: shellUi[SITE_LOCALE.en],
        chrome: shellChrome[SITE_LOCALE.en],
      }),
    );
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

    mounted = await mountClient(
      createElement(InteractiveShell, {
        locale: SITE_LOCALE.en,
        ui: shellUi[SITE_LOCALE.en],
        chrome: shellChrome[SITE_LOCALE.en],
      }),
    );
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
    vi.unstubAllGlobals();
  });

  async function renderShell(): Promise<HTMLElement> {
    const { InteractiveShell } = await import('./InteractiveShell');
    mounted = await mountClient(
      createElement(InteractiveShell, {
        locale: SITE_LOCALE.en,
        ui: shellUi[SITE_LOCALE.en],
        chrome: shellChrome[SITE_LOCALE.en],
      }),
    );
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
      fire(input, new Event('input', { bubbles: true }));
    });
    await act(async () => {
      fire(form, new Event('submit', { bubbles: true, cancelable: true }));
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

describe('InteractiveShell multi-turn history', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
    mounted = await mountClient(
      createElement(InteractiveShell, {
        locale: SITE_LOCALE.en,
        ui: shellUi[SITE_LOCALE.en],
        chrome: shellChrome[SITE_LOCALE.en],
      }),
    );
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

function shellInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="shell command"]');
  expect(input).not.toBeNull();
  return input as HTMLInputElement;
}

function buttonWithText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent === text,
  );
  expect(button).toBeDefined();
  return button as HTMLButtonElement;
}

async function press(element: HTMLElement, key: string, options: KeyboardEventInit = {}) {
  await act(async () => {
    fire(element, new KeyboardEvent('keydown', { key, bubbles: true, ...options }));
  });
}

async function typeDraft(input: HTMLInputElement, text: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, text);
    fire(input, new Event('input', { bubbles: true }));
  });
}

const CAP_TEST_TIMEOUT_MS = 30_000;

describe('InteractiveShell r106 controls', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
    mobileViewport.value = false;
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function renderShell() {
    const { InteractiveShell } = await import('./InteractiveShell');
    mounted = await mountClient(
      createElement(InteractiveShell, {
        locale: SITE_LOCALE.en,
        ui: shellUi[SITE_LOCALE.en],
        chrome: shellChrome[SITE_LOCALE.en],
      }),
    );
    return mounted.container;
  }

  it.each([false, true])('stops thinking and returns focus, mobile=%s', async (mobile) => {
    mobileViewport.value = mobile;
    let signal: AbortSignal | undefined;
    let resolveFetch: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, init: RequestInit) => {
        signal = init.signal as AbortSignal;
        return new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        });
      }),
    );
    const container = await renderShell();
    act(() => shellInput(container).focus());
    await submitQuestion(container, 'question to restore');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('thinking');
    const stop = buttonWithText(container, '[STOP]');
    await act(async () => {
      act(() => stop.focus());
      stop.click();
    });
    expect(signal?.aborted).toBe(true);
    expect(shellInput(container).value).toBe('question to restore');
    expect(document.activeElement).toBe(shellInput(container));
    expect(container.querySelector('[role="log"]')?.getAttribute('aria-busy')).toBe('false');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('stopped before');
    expect(container.querySelector('[data-testid="shell-reference"]')).toBeNull();
    await act(async () => {
      resolveFetch(streamingResponse(['late answer']));
    });
    expect(container.textContent).not.toContain('late answer');
  });

  it('puts the stop control in the answer area, so the input row never changes while thinking', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const container = await renderShell();
    expect(container.querySelector('.shell-stop')).toBeNull();
    const rowCount = () => container.querySelector('.interactive-shell')?.children.length;
    const rowsIdle = rowCount();

    await submitQuestion(container, 'question in flight');

    const stop = buttonWithText(container, '[STOP]');
    expect(stop.closest('[role="log"]')).not.toBeNull();
    expect(container.querySelector('.shell-form button')).toBeNull();
    expect(rowCount()).toBe(rowsIdle);
  });

  it('stops a live stream, keeps partial text and the real reference, and ignores queued frames', async () => {
    let signal: AbortSignal | undefined;
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('Partial answer'));
      },
      cancel,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init: RequestInit) => {
        signal = init.signal as AbortSignal;
        return new Response(body, { headers: { 'X-Request-Id': 'real-request-42' } });
      }),
    );
    const container = await renderShell();
    await submitQuestion(container, 'stream a response');
    await flushFrames();
    expect(container.querySelector('[role="log"]')?.textContent).toContain('Partial answer');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('answer started');
    await act(async () => {
      buttonWithText(container, '[STOP]').click();
    });
    await flushFrames();
    expect(signal?.aborted).toBe(true);
    expect(cancel).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="log"]')?.textContent).toContain('Partial answer');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('incomplete');
    expect(container.querySelector('[data-testid="shell-reference"]')?.textContent).toContain(
      'real-request-42',
    );
    expect(container.querySelector('[data-testid="shell-line-loading"]')).toBeNull();
  });

  it('keeps drafts usable while guarding duplicate submits and inert chip activation', async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', fetchMock);
    const container = await renderShell();
    await submitQuestion(container, 'first question');
    expect(shellInput(container).disabled).toBe(false);
    await submitQuestion(container, 'draft follow-up');
    await act(async () => {
      buttonWithText(container, 'whois').click();
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'An answer is in progress',
    );
    expect(shellInput(container).value).toBe('draft follow-up');
    await act(async () => {
      buttonWithText(container, '[STOP]').click();
    });
    expect(shellInput(container).value).toBe('draft follow-up');
  });

  it('uses the real 429 error without inventing a retry duration, then runs local commands', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        { error: 'rate limit exceeded, try again in an hour' },
        { status: 429, headers: { 'X-Request-Id': 'limited-request' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const container = await renderShell();
    await submitQuestion(container, 'limited question');
    expect(container.querySelector('[data-kind="error"]')?.textContent).toContain(
      'try again in an hour',
    );
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'try again in an hour',
    );
    expect(shellInput(container).value).toBe('limited question');
    expect(container.querySelector('[data-testid="shell-reference"]')?.textContent).toContain(
      'limited-request',
    );
    await submitQuestion(container, 'help');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="log"]')?.textContent).toContain('commands:');
  });

  it('renders the contact address in a shell error as a mailto link', async () => {
    const address = 'erikhenriquealvescunha@gmail.com';
    const fetchMock = vi.fn(async () =>
      Response.json(
        { error: `AI answers are paused for this month. Email ${address} instead.` },
        { status: 503 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const container = await renderShell();
    await submitQuestion(container, 'budget question');
    const line = container.querySelector('[data-kind="error"]');
    const link = line?.querySelector('a');
    expect(link?.getAttribute('href')).toBe(`mailto:${address}`);
    expect(link?.textContent).toBe(address);
    expect(line?.textContent).toContain('AI answers are paused for this month. Email');
    expect(line?.textContent).toContain('instead.');
  });

  it('keeps shell error text without the address as plain text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'rate limit exceeded' }, { status: 429 })),
    );
    const container = await renderShell();
    await submitQuestion(container, 'limited question');
    expect(container.querySelector('[data-kind="error"] a')).toBeNull();
  });

  it('reports an offline failure, restores the question and leaves local commands usable', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    const container = await renderShell();
    act(() => shellInput(container).focus());
    await submitQuestion(container, 'offline question');
    expect(container.querySelector('[data-kind="error"]')?.textContent).toContain('offline');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('offline');
    expect(shellInput(container).value).toBe('offline question');
    expect(document.activeElement).toBe(shellInput(container));
    expect(container.querySelector('[data-testid="shell-reference"]')).toBeNull();
    await submitQuestion(container, 'whois');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="log"]')?.textContent).toContain('erik');
  });

  it('aborts a hung request after the named timeout and allows retry', async () => {
    const { SHELL_LIMITS } = await import('@/content/shell-ui');
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, init: RequestInit) => {
        signal = init.signal as AbortSignal;
        return new Promise<Response>(() => undefined);
      }),
    );
    const container = await renderShell();
    vi.useFakeTimers();
    await submitQuestion(container, 'slow question');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SHELL_LIMITS.requestTimeoutMs);
    });
    expect(signal?.aborted).toBe(true);
    expect(container.querySelector('[data-kind="error"]')?.textContent).toContain('went quiet');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('went quiet');
    expect(shellInput(container).value).toBe('slow question');
    expect(container.querySelector('[role="log"]')?.getAttribute('aria-busy')).toBe('false');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamingResponse(['retry worked'])),
    );
    await submitQuestion(container, 'retry');
    expect(container.querySelector('[role="log"]')?.textContent).toContain('retry worked');
  });

  it('keeps a streaming answer alive past the total budget while chunks keep arriving', async () => {
    const { SHELL_LIMITS } = await import('@/content/shell-ui');
    const enc = new TextEncoder();
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controllerRef = controller;
        controller.enqueue(enc.encode('chunk0 '));
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body)),
    );
    const container = await renderShell();
    vi.useFakeTimers();
    await submitQuestion(container, 'long answer');
    const step = Math.floor(SHELL_LIMITS.requestTimeoutMs * 0.6);
    for (let index = 1; index <= 3; index++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(step);
        controllerRef?.enqueue(enc.encode(`chunk${index} `));
        await vi.advanceTimersByTimeAsync(0);
      });
    }
    expect(container.querySelector('[data-kind="error"]')).toBeNull();
    expect(container.querySelector('[role="log"]')?.getAttribute('aria-busy')).toBe('true');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SHELL_LIMITS.requestTimeoutMs);
    });
    expect(container.querySelector('[data-kind="error"]')?.textContent).toContain('went quiet');
  });

  it('restores the question when a stream with partial text is stopped', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('Partial answer'));
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body)),
    );
    const container = await renderShell();
    await submitQuestion(container, 'question to keep');
    await flushFrames();
    await act(async () => {
      buttonWithText(container, '[STOP]').click();
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain('incomplete');
    expect(shellInput(container).value).toBe('question to keep');
  });

  it('re-engages scroll-follow when a command is submitted after scrolling up', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('answer')),
    );
    const container = await renderShell();
    const feed = container.querySelector<HTMLElement>('[role="log"]') as HTMLElement;
    let scrollTop = 0;
    Object.defineProperty(feed, 'scrollHeight', { configurable: true, value: 900 });
    Object.defineProperty(feed, 'clientHeight', { configurable: true, value: 100 });
    Object.defineProperty(feed, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    await act(async () => {
      fire(feed, new Event('scroll', { bubbles: true }));
    });
    expect(scrollTop).toBe(0);
    await submitQuestion(container, 'new question');
    expect(scrollTop).toBe(900);
  });

  it('does not submit when Enter confirms an IME composition', async () => {
    const fetchMock = vi.fn(async () => new Response('answer'));
    vi.stubGlobal('fetch', fetchMock);
    const container = await renderShell();
    const input = shellInput(container);
    const submit = vi.fn((event: Event) => event.preventDefault());
    container.querySelector('form')?.addEventListener('submit', submit);
    const composing = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
      isComposing: true,
    });
    const legacy = new KeyboardEvent('keydown', {
      key: 'Enter',
      keyCode: 229,
      bubbles: true,
      cancelable: true,
    });
    const plain = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    await act(async () => {
      fire(input, composing);
      fire(input, legacy);
      fire(input, plain);
    });
    expect(composing.defaultPrevented).toBe(true);
    expect(legacy.defaultPrevented).toBe(true);
    expect(plain.defaultPrevented).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['stream failure', () => streamingResponse(['Partial\x00ERR:upstream error'])],
    ['empty body', () => new Response(null)],
    ['HTTP failure', () => new Response('not json', { status: 503 })],
  ] as const)('reports %s and never reports answer complete', async (_name, response) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response()),
    );
    const container = await renderShell();
    await submitQuestion(container, 'a question');
    expect(container.querySelector('[data-kind="error"]')).not.toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).not.toContain(
      'answer complete',
    );
    expect(container.querySelector('[role="log"]')?.getAttribute('aria-busy')).toBe('false');
  });

  it('copies the actual header value and shows a failed copy with a retry', async () => {
    const writeText = vi
      .fn()
      .mockRejectedValueOnce(new Error('denied'))
      .mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText }, onLine: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('answer', {
            headers: { 'X-Request-Id': 'server-reference-123' },
          }),
      ),
    );
    const container = await renderShell();
    await submitQuestion(container, 'reference please');
    expect(buttonWithText(container, 'COPY').getAttribute('aria-label')).toBe(
      'COPY ref server-reference-123',
    );
    await act(async () => {
      buttonWithText(container, 'COPY').click();
    });
    expect(buttonWithText(container, 'COPY FAILED').getAttribute('aria-label')).toBe(
      'COPY FAILED ref server-reference-123',
    );
    expect(writeText).toHaveBeenCalledWith('server-reference-123');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Copy failed');
    await act(async () => {
      buttonWithText(container, 'COPY FAILED').click();
    });
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(buttonWithText(container, 'COPIED').getAttribute('aria-label')).toBe(
      'COPIED ref server-reference-123',
    );
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Reference copied');
  });

  it('shows a copy failure when the clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('answer', {
            headers: { 'X-Request-Id': 'manual-copy-reference' },
          }),
      ),
    );
    const container = await renderShell();
    await submitQuestion(container, 'copy without clipboard');
    await act(async () => {
      buttonWithText(container, 'COPY').click();
    });
    expect(buttonWithText(container, 'COPY FAILED')).toBeDefined();
    expect(container.querySelector('[role="status"]')?.textContent).toContain('manually');
    expect(container.querySelector('[data-testid="shell-reference"]')?.textContent).toContain(
      'manual-copy-reference',
    );
  });

  it.each([false, true])('returns focus on completion, mobile=%s', async (mobile) => {
    mobileViewport.value = mobile;
    let complete: () => void = () => undefined;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        complete = () => controller.close();
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body)),
    );
    const container = await renderShell();
    await submitQuestion(container, 'focus on completion');
    act(() => buttonWithText(container, '[STOP]').focus());
    await act(async () => {
      complete();
    });
    expect(document.activeElement).toBe(shellInput(container));
    expect(container.querySelector('[role="status"]')?.textContent).toContain('answer complete');
  });

  it.each(['log', 'shortcut', 'privacy link', 'input'])(
    'preserves focus on the %s when an answer completes',
    async (target) => {
      let complete: () => void = () => undefined;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          complete = () => controller.close();
        },
      });
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(body)),
      );
      const container = await renderShell();
      await submitQuestion(container, 'keep my focus');
      const focused =
        target === 'log'
          ? container.querySelector<HTMLElement>('[role="log"]')
          : target === 'shortcut'
            ? buttonWithText(container, 'help')
            : target === 'privacy link'
              ? container.querySelector<HTMLElement>('.shell-privacy-notice a')
              : shellInput(container);
      expect(focused).not.toBeNull();
      await act(async () => {
        act(() => focused?.focus());
      });
      expect(document.activeElement).toBe(focused);
      await act(async () => {
        complete();
      });
      expect(document.activeElement).toBe(focused);
      expect(container.querySelector('[role="log"]')?.getAttribute('aria-busy')).toBe('false');
    },
  );

  it.each([0, 20, 21, 200])(
    'follows streamed output only when already within one line of the bottom, gap=%s',
    async (gap) => {
      let stream!: ReadableStreamDefaultController<Uint8Array>;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          stream = controller;
        },
      });
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(body)),
      );
      const container = await renderShell();
      await submitQuestion(container, 'stream while I read');
      const feed = container.querySelector<HTMLElement>('[role="log"]') as HTMLElement;
      let scrollHeight = 1000;
      Object.defineProperties(feed, {
        scrollHeight: { configurable: true, get: () => scrollHeight },
        clientHeight: { configurable: true, value: 200 },
      });
      feed.style.lineHeight = '20px';
      await act(async () => {
        feed.scrollTop = 800 - gap;
        fire(feed, new Event('scroll'));
      });
      scrollHeight = 1400;
      await act(async () => {
        stream.enqueue(new TextEncoder().encode('New streamed output'));
      });
      await flushFrames();
      expect(feed.textContent).toContain('New streamed output');
      expect(feed.scrollTop).toBe(gap <= 20 ? 1400 : 800 - gap);
      scrollHeight = 1600;
      await act(async () => {
        stream.close();
      });
      expect(feed.scrollTop).toBe(gap <= 20 ? 1600 : 800 - gap);
      await act(async () => {
        feed.scrollTop = 1400;
        fire(feed, new Event('scroll'));
      });
      scrollHeight = 1800;
      await submitQuestion(container, 'help');
      expect(feed.scrollTop).toBe(1800);
    },
  );

  it('does not fabricate a reference when the response has no header', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamingResponse(['answer'])),
    );
    const container = await renderShell();
    await submitQuestion(container, 'without a reference');
    expect(container.querySelector('[data-testid="shell-reference"]')).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain('answer complete');
  });

  it('recalls commands with arrows and restores the unsent draft without intercepting modifiers', async () => {
    const container = await renderShell();
    await submitQuestion(container, 'help');
    await submitQuestion(container, 'whois');
    const input = shellInput(container);
    await typeDraft(input, 'unsent draft');
    await press(input, 'ArrowUp', { ctrlKey: true });
    expect(input.value).toBe('unsent draft');
    await press(input, 'ArrowUp');
    expect(input.value).toBe('whois');
    await press(input, 'ArrowUp');
    expect(input.value).toBe('help');
    await press(input, 'ArrowDown');
    expect(input.value).toBe('whois');
    await press(input, 'ArrowDown');
    expect(input.value).toBe('unsent draft');
  });

  it.each([false, true])(
    'provides one toolbar tab stop, wraparound, Home/End and focus return, mobile=%s',
    async (mobile) => {
      mobileViewport.value = mobile;
      const container = await renderShell();
      const toolbar = container.querySelector('[role="toolbar"]') as HTMLElement;
      const buttons = Array.from(toolbar.querySelectorAll('button'));
      expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);
      const first = buttons[0] as HTMLButtonElement;
      act(() => first.focus());
      await press(first, 'ArrowLeft');
      expect(document.activeElement).toBe(buttons.at(-1));
      await press(buttons.at(-1) as HTMLElement, 'ArrowRight');
      expect(document.activeElement).toBe(buttons[0]);
      await press(first, 'End');
      expect(document.activeElement).toBe(buttons.at(-1));
      await press(buttons.at(-1) as HTMLElement, 'Home');
      expect(document.activeElement).toBe(buttons[0]);
      await act(async () => {
        first.click();
      });
      expect(document.activeElement).toBe(shellInput(container));
      expect(shellInput(container).value).toBe('help');
      expect(container.querySelector('[role="status"]')?.textContent).not.toContain(
        'Command complete',
      );
      expect(container.querySelector('[role="log"]')?.textContent).not.toContain(
        'erik@portfolio:~$ help',
      );
    },
  );

  it(
    'caps rendered lines and command recall, and announces clear',
    async () => {
      const CHEAP_COMMAND = 'whoami';
      const { SHELL_LIMITS } = await import('@/content/shell-ui');
      const container = await renderShell();
      await submitQuestion(container, 'whois');
      for (let index = 0; index < SHELL_LIMITS.commandHistory; index++) {
        await submitQuestion(container, CHEAP_COMMAND);
      }
      for (let index = 0; index <= SHELL_LIMITS.commandHistory; index++) {
        await press(shellInput(container), 'ArrowUp');
      }
      expect(shellInput(container).value).toBe(CHEAP_COMMAND);
      expect(container.querySelector('[role="log"]')?.children.length).toBeLessThanOrEqual(50);
      await submitQuestion(container, 'clear');
      expect(container.querySelector('[role="log"]')?.children.length).toBe(1);
      expect(container.querySelector('[role="status"]')?.textContent).toContain('log cleared');
    },
    CAP_TEST_TIMEOUT_MS,
  );

  it('aborts the request and cancels its reader when unmounted', async () => {
    let signal: AbortSignal | undefined;
    const cancel = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init: RequestInit) => {
        signal = init.signal as AbortSignal;
        return new Response(new ReadableStream({ cancel }));
      }),
    );
    const container = await renderShell();
    await submitQuestion(container, 'pending');
    mounted.unmount();
    mounted = undefined as unknown as MountedClient;
    expect(signal?.aborted).toBe(true);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('describes the input with the accuracy notice and validates all shell UI copy with Zod', async () => {
    const { shellUi } = await import('@/content/shell-ui');
    const { ShellUiSchema } = await import('@/content/schemas');
    // both locale copies validate, and both carry the same key set
    for (const locale of ['en', 'pt'] as const) {
      expect(ShellUiSchema.safeParse(shellUi[locale]).success).toBe(true);
      expect(ShellUiSchema.safeParse({ ...shellUi[locale], stop: '' }).success).toBe(false);
    }
    expect(Object.keys(shellUi.en)).toEqual(Object.keys(shellUi.pt));
    expect(Object.keys(shellUi[SITE_LOCALE.en])).not.toContain('copyLabel');
    expect(Object.keys(ShellUiSchema.shape)).not.toContain('copyLabel');
    const container = await renderShell();
    const noticeId = shellInput(container).getAttribute('aria-describedby');
    const notice = Array.from(container.querySelectorAll('[id]')).find(
      (node) => node.id === noticeId,
    );
    expect(notice?.textContent).toContain('can be wrong');
  });
});

describe('shell input hint states', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
    mobileViewport.value = false;
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderShell(): Promise<HTMLElement> {
    const { InteractiveShell } = await import('./InteractiveShell');
    mounted = await mountClient(
      createElement(InteractiveShell, {
        locale: SITE_LOCALE.en,
        ui: shellUi[SITE_LOCALE.en],
        chrome: shellChrome[SITE_LOCALE.en],
      }),
    );
    return mounted.container;
  }

  it('keeps a visible hint while the empty input holds focus', async () => {
    const { shellUi } = await import('@/content/shell-ui');
    const container = await renderShell();
    const input = shellInput(container);

    const idleHint = container.querySelector('[data-testid="shell-placeholder"]');
    expect(idleHint, 'the idle shell must offer a suggestion').not.toBeNull();
    expect(
      idleHint?.querySelector('[data-testid="shell-cursor"]'),
      'the idle hint runs the typing animation',
    ).not.toBeNull();

    await act(async () => {
      fire(input, new FocusEvent('focusin', { bubbles: true }));
    });

    const focusedHint = container.querySelector('[data-testid="shell-placeholder"]');
    expect(focusedHint, 'a focused empty input must keep a visible hint').not.toBeNull();
    expect(focusedHint?.textContent).toBe(shellUi[SITE_LOCALE.en].placeholder);
    expect(
      focusedHint?.querySelector('[data-testid="shell-cursor"]'),
      'the typing animation must not run while the input holds focus',
    ).toBeNull();
  });

  it('keeps a visible hint while an answer streams', async () => {
    const { shellUi } = await import('@/content/shell-ui');
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        await gate;
        return new Response('answer', { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }),
    );

    const container = await renderShell();
    await submitQuestion(container, 'a question');
    await flushMicrotasks();

    const hint = container.querySelector('[data-testid="shell-placeholder"]');
    expect(hint, 'the empty input must keep a visible hint while an answer streams').not.toBeNull();
    expect(hint?.textContent).toBe(shellUi[SITE_LOCALE.en].placeholder);
    expect(
      hint?.querySelector('[data-testid="shell-cursor"]'),
      'the typing animation must not run while an answer streams',
    ).toBeNull();

    release();
    await flushMicrotasks();
  });
});

describe('InteractiveShell stream states', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
    mobileViewport.value = false;
  });

  afterEach(() => {
    vi.useRealTimers();
    mounted?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderShell(locale: SiteLocale = SITE_LOCALE.en): Promise<HTMLElement> {
    const { InteractiveShell } = await import('./InteractiveShell');
    mounted = await mountClient(
      createElement(InteractiveShell, {
        locale,
        ui: shellUi[locale],
        chrome: shellChrome[locale],
      }),
    );
    return mounted.container;
  }

  function loadingLine(container: HTMLElement): Element | null {
    return container.querySelector('[data-testid="shell-line-loading"]');
  }

  describe('copy', () => {
    it.each(Object.values(SITE_LOCALE))(
      'parses and keeps its placeholders in %s',
      async (locale) => {
        const { ShellStatesSchema } = await import('@/content/shell-states.schema');
        const { shellStates, SHELL_STATE_TOKEN } = await import('@/content/shell-ui');
        const copy = ShellStatesSchema.parse(shellStates[locale]);
        expect(copy.thinkingElapsed).toContain(SHELL_STATE_TOKEN.seconds);
        expect(copy.timeoutBody).toContain(SHELL_STATE_TOKEN.seconds);
        expect(copy.slowDown).toContain(SHELL_STATE_TOKEN.left);
        expect(Object.values(copy).join(' ')).not.toMatch(/[\u2013\u2014]/);
      },
    );
  });

  describe('E3 stderr', () => {
    const address = 'erikhenriquealvescunha@gmail.com';

    it.each([
      [SITE_LOCALE.en, 'temporarily unavailable', 'try: cat stack.md (works offline) or write to'],
      [
        SITE_LOCALE.pt,
        'temporariamente indisponível',
        'tente: cat stack.md (funciona offline) ou escreva para',
      ],
    ] as const)(
      'prints the status command, a local fallback and the request id in %s',
      async (locale, message, tryText) => {
        vi.stubGlobal(
          'fetch',
          vi.fn(async () =>
            Response.json(
              { error: message },
              { status: 503, headers: { 'X-Request-Id': 'req-503' } },
            ),
          ),
        );
        const container = await renderShell(locale);
        await submitQuestion(container, 'qual a stack dele?');
        const lines = Array.from(container.querySelectorAll('[role="log"] > .shell-line'));
        const errorIndex = lines.findIndex((line) => line.getAttribute('data-kind') === 'error');
        const error = lines[errorIndex];
        expect(error?.textContent).toBe(`ask: 503 ${message}`);
        expect(error?.querySelector('strong')?.textContent).toBe('ask: 503');
        const hint = lines[errorIndex + 1];
        expect(hint?.getAttribute('data-kind')).toBe('hint');
        expect(hint?.textContent).toBe(`${tryText} ${address}`);
        expect(hint?.querySelector('code')?.textContent).toBe('cat stack.md');
        expect(hint?.querySelector('a')?.getAttribute('href')).toBe(`mailto:${address}`);
        expect(lines[errorIndex + 2]?.textContent).toContain('req-503');
        expect(lines[errorIndex + 2]?.querySelector('button')).not.toBeNull();
      },
    );

    it('keeps 4xx errors to the status line without a fallback suggestion', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ error: 'question is required' }, { status: 400 })),
      );
      const container = await renderShell();
      await submitQuestion(container, 'x');
      expect(container.querySelector('[data-kind="error"]')?.textContent).toBe(
        'ask: 400 question is required',
      );
      expect(container.querySelector('[data-kind="hint"]')).toBeNull();
    });

    it('still offers the offline fallback when the server message names the address', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          Response.json({ error: `paused. Email ${address} instead.` }, { status: 503 }),
        ),
      );
      const container = await renderShell();
      await submitQuestion(container, 'x');
      expect(container.querySelector('[data-kind="hint"] code')?.textContent).toBe('cat stack.md');
    });

    it('says what to do when the body has no message, never a bare status label', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('', { status: 502 })),
      );
      const container = await renderShell();
      await submitQuestion(container, 'x');
      expect(container.querySelector('[data-kind="error"]')?.textContent).toBe(
        `ask: 502 ${shellUi[SITE_LOCALE.en].serverError}`,
      );
    });
  });

  describe('E4 rate limit', () => {
    const TOTAL_SECONDS = 2280;
    const COUNTDOWN_BAR = /^\[([#.]{20})\]$/;

    function limitedResponse(retryAfter?: string): Response {
      return Response.json(
        { error: 'rate limit exceeded: try again in an hour' },
        {
          status: 429,
          headers: {
            'X-Request-Id': 'limited-request',
            ...(retryAfter === undefined ? {} : { 'Retry-After': retryAfter }),
          },
        },
      );
    }

    async function askLimited(retryAfter?: string, locale?: SiteLocale): Promise<HTMLElement> {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => limitedResponse(retryAfter)),
      );
      const container = await renderShell(locale);
      vi.useFakeTimers();
      await submitQuestion(container, 'limited question');
      return container;
    }

    function visible(container: HTMLElement): HTMLElement {
      const node = container.querySelector<HTMLElement>('[data-kind="ratelimit"] [aria-hidden]');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    }

    function bar(container: HTMLElement): string {
      const text = visible(container).querySelector('.shell-ratelimit-bar')?.textContent ?? '';
      const match = COUNTDOWN_BAR.exec(text);
      expect(match, `bar text ${text}`).not.toBeNull();
      return match?.[1] ?? '';
    }

    it('turns Retry-After into a visible countdown that keeps the local commands in reach', async () => {
      const container = await askLimited(String(TOTAL_SECONDS));
      const headline = visible(container).querySelector('strong');
      expect(headline?.textContent).toBe('! slow down: 38 min until the next question');
      expect(bar(container)).toBe('.'.repeat(20));
      expect(visible(container).textContent).toContain(
        'Local commands keep working meanwhile: help, cat stack.md, whoami.',
      );
      expect(container.querySelector('[data-kind="error"]')).toBeNull();
      expect(container.querySelector('[data-testid="shell-reference"]')?.textContent).toContain(
        'limited-request',
      );
      expect((container.querySelector('input[name="command"]') as HTMLInputElement).value).toBe(
        'limited question',
      );
    });

    it('fills the bar and lowers the minutes as time passes', async () => {
      const container = await askLimited(String(TOTAL_SECONDS));
      await act(async () => {
        await vi.advanceTimersByTimeAsync((TOTAL_SECONDS / 2) * 1000);
      });
      expect(visible(container).querySelector('strong')?.textContent).toBe(
        '! slow down: 19 min until the next question',
      );
      expect(bar(container)).toBe(`${'#'.repeat(10)}${'.'.repeat(10)}`);
    });

    it('counts the last minute in seconds and says when asking works again', async () => {
      const container = await askLimited('45');
      expect(visible(container).querySelector('strong')?.textContent).toBe(
        '! slow down: 45 s until the next question',
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(45_000);
      });
      expect(visible(container).querySelector('strong')?.textContent).toBe(
        '> ready: you can ask again',
      );
      expect(bar(container)).toBe('#'.repeat(20));
    });

    it('announces the wait once and keeps the ticking text out of assistive tech', async () => {
      const container = await askLimited(String(TOTAL_SECONDS));
      const announced = container.querySelector('[role="status"]')?.textContent;
      expect(announced).toContain('! slow down: 38 min until the next question');
      const staticText = container.querySelector('[data-kind="ratelimit"] .sr-only')?.textContent;
      expect(staticText).toContain('! slow down: 38 min until the next question');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600_000);
      });
      expect(container.querySelector('[data-kind="ratelimit"] .sr-only')?.textContent).toBe(
        staticText,
      );
      expect(container.querySelector('[role="status"]')?.textContent).toBe(announced);
      expect(visible(container).getAttribute('aria-hidden')).toBe('true');
      expect(container.querySelector('[data-kind="ratelimit"]')?.getAttribute('role')).toBeNull();
    });

    it('speaks Portuguese', async () => {
      const container = await askLimited(String(TOTAL_SECONDS), SITE_LOCALE.pt);
      expect(visible(container).querySelector('strong')?.textContent).toBe(
        '! vá com calma: 38 min até a próxima pergunta',
      );
    });

    it('stops ticking when the shell unmounts', async () => {
      const container = await askLimited(String(TOTAL_SECONDS));
      expect(container.querySelector('[data-kind="ratelimit"]')).not.toBeNull();
      const pending = vi.getTimerCount();
      mounted.unmount();
      expect(vi.getTimerCount()).toBeLessThan(pending);
    });

    it.each([
      ['absent', undefined],
      ['zero', '0'],
      ['negative', '-5'],
      ['a date', 'Wed, 21 Oct 2026 07:28:00 GMT'],
      ['fractional', '12.5'],
      ['text', 'soon'],
    ])('invents no duration when Retry-After is %s', async (_name, header) => {
      const container = await askLimited(header);
      expect(container.querySelector('[data-kind="ratelimit"]')).toBeNull();
      expect(container.querySelector('[data-kind="error"]')?.textContent).toBe(
        'ask: 429 rate limit exceeded: try again in an hour. Built-in commands still work.',
      );
    });
  });

  describe('E9 timeout', () => {
    const IDLE_MS = 15_000;

    function hangingFetch(chunk?: string, asked: string[] = []) {
      const enc = new TextEncoder();
      return vi.fn(async (_url: string, init: RequestInit) => {
        asked.push(JSON.parse(init.body as string).question);
        if (chunk === undefined) return new Promise<Response>(() => undefined);
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(enc.encode(chunk));
            },
          }),
        );
      });
    }

    it('gives the model exactly fifteen seconds of silence', async () => {
      vi.stubGlobal('fetch', hangingFetch());
      const container = await renderShell();
      vi.useFakeTimers();
      await submitQuestion(container, 'slow question');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(IDLE_MS - 1);
      });
      expect(container.querySelector('[data-kind="error"]')).toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      const error = container.querySelector('[data-kind="error"]');
      expect(error?.querySelector('strong')?.textContent).toBe('ask: timeout');
      expect(error?.textContent).toContain(
        'the model went quiet for 15s. The partial answer above is kept.',
      );
    });

    it('keeps the partial answer above the timeout line', async () => {
      vi.stubGlobal('fetch', hangingFetch('Partial answer'));
      const container = await renderShell();
      vi.useFakeTimers();
      await submitQuestion(container, 'slow question');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(IDLE_MS);
      });
      const lines = Array.from(container.querySelectorAll('[role="log"] > .shell-line'));
      const answer = lines.findIndex((line) => line.textContent?.includes('Partial answer'));
      const error = lines.findIndex((line) => line.getAttribute('data-kind') === 'error');
      expect(answer).toBeGreaterThan(-1);
      expect(error).toBeGreaterThan(answer);
    });

    it('retries the same question from the timeout line', async () => {
      const asked: string[] = [];
      vi.stubGlobal('fetch', hangingFetch(undefined, asked));
      const container = await renderShell();
      vi.useFakeTimers();
      await submitQuestion(container, 'slow question');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(IDLE_MS);
      });
      const retry = container.querySelector<HTMLButtonElement>('[data-kind="error"] button');
      expect(retry?.textContent).toBe('[ RETRY ]');
      expect(retry?.getAttribute('aria-label')).toBe('Retry the last question');
      await act(async () => {
        retry?.click();
      });
      expect(asked).toEqual(['slow question', 'slow question']);
      expect(container.querySelector('[role="log"]')?.getAttribute('aria-busy')).toBe('true');
    });

    it('speaks Portuguese', async () => {
      vi.stubGlobal('fetch', hangingFetch());
      const container = await renderShell(SITE_LOCALE.pt);
      vi.useFakeTimers();
      await submitQuestion(container, 'pergunta lenta');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(IDLE_MS);
      });
      const error = container.querySelector('[data-kind="error"]');
      expect(error?.textContent).toContain(
        'o modelo ficou em silêncio por 15s. A resposta parcial acima foi mantida.',
      );
      expect(error?.querySelector('button')?.textContent).toBe('[ TENTAR DE NOVO ]');
    });
  });

  describe('L5 streaming', () => {
    it('ticks the elapsed time before the first token and hides it from assistive tech', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => new Promise<Response>(() => undefined)),
      );
      const container = await renderShell();
      vi.useFakeTimers();
      await submitQuestion(container, 'slow question');
      expect(loadingLine(container)?.textContent).toContain('[ thinking 0.0s ]');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1200);
      });
      expect(loadingLine(container)?.textContent).toContain('[ thinking 1.2s ]');
      expect(loadingLine(container)?.getAttribute('aria-hidden')).toBe('true');
    });

    it('says how to stop while an answer is pending and drops the hint once it settles', async () => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          await gate;
          return streamingResponse(['done']);
        }),
      );
      const container = await renderShell();
      await submitQuestion(container, 'a question');
      expect(container.querySelector('.shell-stop-row')?.textContent).toContain('[ Esc ] stop');
      release();
      await flushMicrotasks();
      await flushFrames();
      expect(container.querySelector('[role="log"]')?.textContent).not.toContain('[ Esc ] stop');
    });

    it('shows a block caret after the streamed text and removes it when the answer ends', async () => {
      const enc = new TextEncoder();
      let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controllerRef = controller;
          controller.enqueue(enc.encode('Partial'));
        },
      });
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(body)),
      );
      const container = await renderShell();
      await submitQuestion(container, 'a question');
      await flushMicrotasks();
      await flushFrames();
      const caret = container.querySelector('.shell-caret');
      expect(caret?.textContent).toBe('█');
      expect(caret?.getAttribute('aria-hidden')).toBe('true');
      expect(container.querySelector('[role="log"]')?.textContent).toContain('[ Esc ] stop');
      await act(async () => {
        controllerRef?.close();
      });
      await flushMicrotasks();
      await flushFrames();
      expect(container.querySelector('.shell-caret')).toBeNull();
      expect(container.querySelector('[role="log"]')?.textContent).toContain('Partial');
    });

    it('stops the answer on Escape pressed inside the shell', async () => {
      let signal: AbortSignal | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn((_url, init: RequestInit) => {
          signal = init.signal as AbortSignal;
          return new Promise<Response>(() => undefined);
        }),
      );
      const container = await renderShell();
      await submitQuestion(container, 'a question');
      await press(shellInput(container), 'Escape');
      expect(signal?.aborted).toBe(true);
      expect(container.querySelector('[role="status"]')?.textContent).toContain('stopped before');
    });

    it('ignores Escape pressed outside the shell', async () => {
      let signal: AbortSignal | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn((_url, init: RequestInit) => {
          signal = init.signal as AbortSignal;
          return new Promise<Response>(() => undefined);
        }),
      );
      const container = await renderShell();
      await submitQuestion(container, 'a question');
      await press(document.body, 'Escape');
      expect(signal?.aborted).toBe(false);
    });
  });
});

describe('InteractiveShell failure copy', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function failWith(locale: SiteLocale, response: () => Response | Promise<Response>) {
    const { InteractiveShell } = await import('./InteractiveShell');
    vi.stubGlobal('fetch', vi.fn(response));
    mounted = await mountClient(
      createElement(InteractiveShell, {
        locale,
        ui: shellUi[locale],
        chrome: shellChrome[locale],
      }),
    );
    await submitQuestion(mounted.container, 'a question');
    return mounted.container.querySelector('[data-kind="error"]')?.textContent ?? '';
  }

  it.each([SITE_LOCALE.en, SITE_LOCALE.pt])(
    'words a guard abort as a withheld answer, never as the guard reason (%s)',
    async (locale) => {
      const { GUARD_ABORT_PREFIX, STREAM_ERR_SENTINEL } = await import('@/lib/stream-protocol');
      const line = await failWith(locale, () =>
        streamingResponse([`Partial${STREAM_ERR_SENTINEL}${GUARD_ABORT_PREFIX}leak`]),
      );
      expect(line).toContain(shellUi[locale].answerWithheld);
      expect(line, 'the guard reason is internal detail').not.toContain('leak');
      expect(line).not.toContain(GUARD_ABORT_PREFIX);
    },
  );

  it.each([SITE_LOCALE.en, SITE_LOCALE.pt])(
    'words an HTTP failure with no readable detail in the page language (%s)',
    async (locale) => {
      const line = await failWith(locale, () => new Response('', { status: 504, statusText: '' }));
      expect(line, 'a bare status name tells the visitor nothing to do').toContain(
        shellUi[locale].serverError,
      );
      expect(line).not.toMatch(/HTTP|Internal Server Error|Gateway Time-out/);
    },
  );

  it.each([SITE_LOCALE.en, SITE_LOCALE.pt])(
    'ignores an English envelope message and words an oversized request itself (%s)',
    async (locale) => {
      const line = await failWith(
        locale,
        () =>
          new Response(
            JSON.stringify({
              ok: false,
              error: {
                code: 'payload_too_large',
                message: 'request body exceeds the 8192-byte limit',
              },
            }),
            { status: 413, headers: { 'Content-Type': 'application/json' } },
          ),
      );
      expect(line).toContain(shellUi[locale].requestTooLarge);
      expect(line, 'the byte limit is an internal detail').not.toContain('8192');
    },
  );

  it.each([SITE_LOCALE.en, SITE_LOCALE.pt])(
    'does not print the text of an unexpected exception (%s)',
    async (locale) => {
      const line = await failWith(locale, () => {
        throw new RangeError('Invalid array length at fetchInternals');
      });
      expect(line).toContain(shellUi[locale].networkError);
      expect(line).not.toContain('fetchInternals');
    },
  );

  it('keeps a localized server detail on a plain-string error body', async () => {
    const line = await failWith(
      SITE_LOCALE.pt,
      () =>
        new Response(JSON.stringify({ error: 'pergunta identica: espere' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    expect(line).toContain('pergunta identica: espere');
  });
});
