import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  flushFrames,
  flushMicrotasks,
  type MountedClient,
  mountClient,
} from '@/__tests__/helpers/render';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { shellChrome } from '@/content/terminal-chrome';
import { InteractiveShell } from './InteractiveShell';

const parseCalls = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/lib/use-breakpoint.client', () => ({ useBreakpoint: () => ({ isMobile: false }) }));
vi.mock('@/lib/motion', () => ({ readMotion: () => false }));
vi.mock('@/lib/stream-protocol', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stream-protocol')>();
  return {
    ...actual,
    parseStreamChunk: (accumulated: string) => {
      parseCalls.count += 1;
      return actual.parseStreamChunk(accumulated);
    },
  };
});

const CHUNKS = ['alpha ', 'bravo ', 'charlie ', 'delta ', 'echo ', 'foxtrot '];

describe('InteractiveShell stream parsing cost', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    vi.unstubAllGlobals();
  });

  it('parses the accumulated answer once per received chunk, not again per animation frame', async () => {
    const encoder = new TextEncoder();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status: 200 })),
    );
    mounted = await mountClient(
      createElement(InteractiveShell, {
        locale: SITE_LOCALE.en,
        ui: shellUi[SITE_LOCALE.en],
        chrome: shellChrome[SITE_LOCALE.en],
      }),
    );
    const input = mounted.container.querySelector<HTMLInputElement>('input[name="command"]');
    const form = mounted.container.querySelector<HTMLFormElement>('form');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      if (input && setter) setter.call(input, 'tell me about erik');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();
    parseCalls.count = 0;

    for (const chunk of CHUNKS) {
      controller.enqueue(encoder.encode(chunk));
      await flushMicrotasks();
      await flushFrames();
    }
    controller.close();
    await flushMicrotasks();
    await flushFrames();

    expect(mounted.container.querySelector('[role="log"]')?.textContent).toContain('foxtrot');
    expect(
      parseCalls.count,
      'each chunk is parsed once, plus the closing read; the frame callback reuses that result instead of re-parsing the whole buffer',
    ).toBeLessThanOrEqual(CHUNKS.length + 1);
  });
});
