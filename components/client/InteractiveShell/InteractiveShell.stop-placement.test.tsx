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
import { SITE_LOCALE } from '@/content/site-locale';
import { shellChrome } from '@/content/terminal-chrome';

vi.mock('@/lib/use-breakpoint.client', () => ({
  useBreakpoint: () => ({ isMobile: false }),
}));

vi.mock('@/lib/motion', () => ({
  readMotion: () => false,
}));

const ui = shellUi[SITE_LOCALE.en];
const STATUS_TOO_MANY_REQUESTS = 429;
const STATUS_SERVER_ERROR = 500;

function streamOf(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let index = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (index < chunks.length) controller.enqueue(encoder.encode(chunks[index++]));
        else controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
}

function openStream(): { response: Response; finish: () => void } {
  const encoder = new TextEncoder();
  let close: () => void = () => undefined;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('Partial answer'));
        close = () => controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
  return { response, finish: () => close() };
}

describe('the shell stop control lives in the answer area', () => {
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
        ui,
        chrome: shellChrome[SITE_LOCALE.en],
      }),
    );
    return mounted.container;
  }

  function input(container: HTMLElement): HTMLInputElement {
    const field = container.querySelector<HTMLInputElement>('input[name="command"]');
    expect(field).not.toBeNull();
    return field as HTMLInputElement;
  }

  function stopControl(container: HTMLElement): HTMLButtonElement | null {
    return container.querySelector<HTMLButtonElement>(`button[aria-label="${ui.stopLabel}"]`);
  }

  async function ask(container: HTMLElement, question: string): Promise<void> {
    const field = input(container);
    const form = container.querySelector<HTMLFormElement>('form');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        field,
        question,
      );
      fire(field, new Event('input', { bubbles: true }));
    });
    await act(async () => {
      fire(form, new Event('submit', { bubbles: true, cancelable: true }));
    });
  }

  function expectInLogAfter(container: HTMLElement, lineSelector: string): HTMLButtonElement {
    const stop = stopControl(container);
    expect(stop, 'the stop control is shown while the answer is busy').not.toBeNull();
    const log = container.querySelector('[role="log"]');
    expect(stop?.closest('[role="log"]'), 'the stop control sits in the log').toBe(log);
    expect(stop?.closest('.shell-form'), 'the stop control is not in the input row').toBeNull();
    expect(stop?.closest('[aria-hidden="true"]'), 'it stays in the accessibility tree').toBeNull();
    expect(stop?.textContent).toBe(ui.stop);
    const line = log?.querySelector(lineSelector);
    expect(line, `${lineSelector} is rendered`).not.toBeNull();
    expect(
      (line?.compareDocumentPosition(stop as Node) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the stop control follows the line it controls',
    ).toBeTruthy();
    return stop as HTMLButtonElement;
  }

  it('is absent while the shell is idle', async () => {
    const container = await renderShell();
    expect(stopControl(container)).toBeNull();
  });

  it('shows in the log after the thinking line before the first token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const container = await renderShell();
    await ask(container, 'question in flight');
    expectInLogAfter(container, '[data-testid="shell-line-loading"]');
  });

  it('shows in the log after the streaming line and leaves when the answer completes', async () => {
    const stream = openStream();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => stream.response),
    );
    const container = await renderShell();
    await ask(container, 'stream a response');
    await flushFrames();
    expectInLogAfter(container, '.shell-line-output');
    await act(async () => {
      stream.finish();
    });
    await flushMicrotasks();
    await flushFrames();
    expect(container.querySelector('[role="log"]')?.getAttribute('aria-busy')).toBe('false');
    expect(stopControl(container)).toBeNull();
  });

  it('leaves after a stop and returns focus to the input', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const container = await renderShell();
    await ask(container, 'question to stop');
    const stop = expectInLogAfter(container, '[data-testid="shell-line-loading"]');
    await act(async () => {
      act(() => stop.focus());
      stop.click();
    });
    expect(stopControl(container)).toBeNull();
    expect(document.activeElement).toBe(input(container));
  });

  it('leaves after Escape stops the answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const container = await renderShell();
    await ask(container, 'question to escape');
    expect(stopControl(container)).not.toBeNull();
    await act(async () => {
      fire(input(container), new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(stopControl(container)).toBeNull();
  });

  it.each([STATUS_TOO_MANY_REQUESTS, STATUS_SERVER_ERROR])(
    'leaves after a %i error',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ error: 'failed' }, { status })),
      );
      const container = await renderShell();
      await ask(container, 'question that fails');
      await flushMicrotasks();
      expect(container.querySelector('[data-kind="error"]')).not.toBeNull();
      expect(stopControl(container)).toBeNull();
    },
  );

  it('leaves after a complete answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamOf(['A whole answer.'])),
    );
    const container = await renderShell();
    await ask(container, 'question answered');
    await flushMicrotasks();
    await flushFrames();
    await flushFrames();
    expect(container.querySelector('[role="log"]')?.textContent).toContain('A whole answer.');
    expect(stopControl(container)).toBeNull();
  });
});
