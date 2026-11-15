import { act, createElement } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

const renders = vi.hoisted(() => ({ count: 0 }));

vi.mock('../TerminalChromeBar', () => ({
  TerminalChromeBar: () => {
    renders.count += 1;
    return null;
  },
}));

vi.mock('@/lib/use-breakpoint.client', () => ({
  useBreakpoint: () => ({ isMobile: false }),
}));

vi.mock('@/lib/motion', () => ({
  readMotion: () => false,
}));

const MODULE_WARMUP_TIMEOUT_MS = 30_000;
const RENDERS_PER_KEYSTROKE = 1;
const RENDERS_PER_STREAMED_FRAME = 1;
const RENDERS_TO_SUBMIT = 1;
const RENDERS_FOR_FIRST_FRAME = 2;
const RENDERS_TO_SETTLE = 1;

beforeAll(async () => {
  await Promise.all([import('./InteractiveShell'), import('react-dom/client')]);
}, MODULE_WARMUP_TIMEOUT_MS);

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  fire(input, new Event('input', { bubbles: true }));
}

async function rendersDuring(action: () => Promise<void>): Promise<number> {
  const before = renders.count;
  await action();
  return renders.count - before;
}

describe('InteractiveShell render count', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
    renders.count = 0;
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mountShell() {
    const { InteractiveShell } = await import('./InteractiveShell');
    mounted = await mountClient(
      createElement(InteractiveShell, {
        locale: SITE_LOCALE.en,
        ui: shellUi[SITE_LOCALE.en],
        chrome: shellChrome[SITE_LOCALE.en],
      }),
    );
    const input = mounted.container.querySelector<HTMLInputElement>('input[name="command"]');
    const form = mounted.container.querySelector<HTMLFormElement>('form');
    if (!input || !form) throw new Error('shell form not rendered');
    return { input, form };
  }

  it('renders once per typed keystroke', async () => {
    const { input } = await mountShell();
    const word = 'hello';
    const perKeystroke: number[] = [];
    for (let length = 1; length <= word.length; length += 1) {
      const typed = word.slice(0, length);
      perKeystroke.push(
        await rendersDuring(async () => {
          await act(async () => setInputValue(input, typed));
        }),
      );
    }
    expect(perKeystroke).toEqual(Array(word.length).fill(RENDERS_PER_KEYSTROKE));
  });

  it('renders once per streamed frame and a fixed number of times to submit and settle', async () => {
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status: 200 })),
    );
    const { input, form } = await mountShell();
    await act(async () => setInputValue(input, 'what are your strengths?'));

    const submit = await rendersDuring(async () => {
      await act(async () => {
        fire(form, new Event('submit', { bubbles: true, cancelable: true }));
      });
      await flushMicrotasks();
    });

    const firstFrame = await rendersDuring(async () => {
      await act(async () => controller?.enqueue(encoder.encode('one')));
      await flushMicrotasks();
      await flushFrames();
    });
    const secondFrame = await rendersDuring(async () => {
      await act(async () => controller?.enqueue(encoder.encode(' two')));
      await flushMicrotasks();
      await flushFrames();
    });
    const thirdFrame = await rendersDuring(async () => {
      await act(async () => controller?.enqueue(encoder.encode(' three')));
      await flushMicrotasks();
      await flushFrames();
    });
    const settle = await rendersDuring(async () => {
      await act(async () => controller?.close());
      await flushMicrotasks();
      await flushFrames();
    });

    expect({ submit, firstFrame, secondFrame, thirdFrame, settle }).toEqual({
      submit: RENDERS_TO_SUBMIT,
      firstFrame: RENDERS_FOR_FIRST_FRAME,
      secondFrame: RENDERS_PER_STREAMED_FRAME,
      thirdFrame: RENDERS_PER_STREAMED_FRAME,
      settle: RENDERS_TO_SETTLE,
    });
  });
});
