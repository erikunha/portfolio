import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fire, type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { askErrors } from '@/content/ask-errors';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { shellChrome } from '@/content/terminal-chrome';

vi.mock('@/lib/use-breakpoint.client', () => ({
  useBreakpoint: () => ({ isMobile: false }),
}));

vi.mock('@/lib/motion', () => ({
  readMotion: () => false,
}));

function streamingResponse(body: string): Response {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode(body));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
}

async function submitQuestion(container: HTMLElement, question: string): Promise<void> {
  const input = container.querySelector<HTMLInputElement>('input[name="command"]');
  const form = container.querySelector<HTMLFormElement>('form');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    if (input && setter) setter.call(input, question);
    fire(input, new Event('input', { bubbles: true }));
  });
  await act(async () => {
    fire(form, new Event('submit', { bubbles: true, cancelable: true }));
  });
}

describe('InteractiveShell on a model refusal', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([SITE_LOCALE.en, SITE_LOCALE.pt])(
    'shows the refusal line without the wire prefix (%s)',
    async (locale: SiteLocale) => {
      const { REFUSAL_PREFIX, STREAM_ERR_SENTINEL } = await import('@/lib/stream-protocol');
      const { InteractiveShell } = await import('./InteractiveShell');
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          streamingResponse(`${STREAM_ERR_SENTINEL}${REFUSAL_PREFIX}${askErrors[locale].refused}`),
        ),
      );
      mounted = await mountClient(
        createElement(InteractiveShell, {
          locale,
          ui: shellUi[locale],
          chrome: shellChrome[locale],
        }),
      );
      await submitQuestion(mounted.container, 'a question');
      const line = mounted.container.querySelector('[data-kind="error"]')?.textContent ?? '';
      expect(line).toContain(askErrors[locale].refused);
      expect(line).not.toContain(REFUSAL_PREFIX);
    },
  );
});
