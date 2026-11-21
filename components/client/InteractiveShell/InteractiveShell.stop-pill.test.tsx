import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, type MountedClient } from '@/__tests__/helpers/render';
import {
  askQuestion,
  renderShell as mountShell,
  submitCommand,
  typeCommand,
} from '@/__tests__/helpers/shell';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';

vi.mock('@/lib/use-breakpoint.client', () => ({ useBreakpoint: () => ({ isMobile: false }) }));
vi.mock('@/lib/motion', () => ({ readMotion: () => false }));

const ELAPSED_ADVANCE_MS = 250;
const PILL_TEXT = /^■ (stop|parar) · \d+\.\ds$/;

function pending(): { finish: () => void } {
  let close: () => void = () => undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              close = () => controller.close();
            },
          }),
          { headers: { 'X-Request-Id': '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa' } },
        ),
    ),
  );
  return { finish: () => close() };
}

describe('the stop pill', () => {
  let mounted: MountedClient | undefined;

  async function renderShell(locale: SiteLocale = SITE_LOCALE.en) {
    mounted = await mountShell(locale);
    return mounted.container;
  }

  async function ask(container: HTMLElement) {
    await askQuestion(container, 'who is erik?');
  }

  const pill = (container: HTMLElement, locale: SiteLocale = SITE_LOCALE.en) =>
    [...container.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === shellUi[locale].stopLabel,
    );

  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows a stop pill with a live elapsed time and an esc hint, outside the log', async () => {
    pending();
    const container = await renderShell();
    vi.useFakeTimers();
    await typeCommand(container, 'who is erik?');
    await submitCommand(container);
    await act(async () => vi.advanceTimersByTimeAsync(0));
    const button = pill(container);
    expect(button).toBeDefined();
    expect(button?.classList.contains('shell-stop-pill')).toBe(true);
    expect(button?.closest('[role="log"], [aria-live]')).toBeNull();
    const elapsed = button?.querySelector('.shell-stop-elapsed');
    expect(elapsed?.textContent).toMatch(PILL_TEXT);
    expect(button?.querySelector('kbd')?.textContent).toBe(shellUi[SITE_LOCALE.en].escKey);
    const before = elapsed?.textContent;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ELAPSED_ADVANCE_MS);
    });
    expect(button?.querySelector('.shell-stop-elapsed')?.textContent).not.toBe(before);
    expect(container.querySelector('.shell-stop-row')).toBeNull();
  });

  it('uses the pt-BR words', async () => {
    pending();
    const container = await renderShell(SITE_LOCALE.pt);
    await ask(container);
    expect(pill(container, SITE_LOCALE.pt)?.textContent).toContain('parar');
  });

  it('leaves when the answer completes', async () => {
    const stream = pending();
    const container = await renderShell();
    await ask(container);
    expect(pill(container)).toBeDefined();
    await act(async () => stream.finish());
    await flushMicrotasks();
    await flushMicrotasks();
    expect(pill(container)).toBeUndefined();
  });

  it('stops the answer and returns focus to the input', async () => {
    pending();
    const container = await renderShell();
    await ask(container);
    await act(async () => pill(container)?.click());
    await flushMicrotasks();
    expect(pill(container)).toBeUndefined();
    expect(document.activeElement).toBe(container.querySelector('input[name="command"]'));
  });
});
