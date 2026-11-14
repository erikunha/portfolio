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
const LIVE_REGION = '[role="log"], [aria-live], [aria-busy="true"]';

describe('the shell stop control stays outside the live region', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
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

  it('is not a descendant of the log, of any live region or of a busy subtree', async () => {
    const container = await renderShell();
    await ask(container, 'question in flight');
    const stop = stopControl(container);
    expect(stop, 'the stop control is shown while the answer is busy').not.toBeNull();
    expect(stop?.closest(LIVE_REGION), 'a live region would announce the button').toBeNull();
    expect(stop?.closest('[aria-hidden="true"]')).toBeNull();
    expect(stop?.closest('.shell-form')).toBeNull();
  });

  it('sits beside the log inside the same panel, ahead of the input row', async () => {
    const container = await renderShell();
    await ask(container, 'question in flight');
    const stop = stopControl(container) as HTMLButtonElement;
    const log = container.querySelector('[role="log"]') as HTMLElement;
    const form = container.querySelector('.shell-form') as HTMLElement;
    const panel = container.querySelector('.interactive-shell') as HTMLElement;
    expect(panel.contains(stop)).toBe(true);
    const wrap = log.closest('.shell-feed-wrap');
    expect(wrap, 'the log has a wrapper the stop pill can share').not.toBeNull();
    expect(stop.closest('.shell-feed-wrap')).toBe(wrap);
    expect(
      stop.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the stop control comes before the input row',
    ).toBeTruthy();
  });

  it('returns focus to the input when STOP is activated without ever taking focus', async () => {
    const container = await renderShell();
    await ask(container, 'question to stop');
    const stop = stopControl(container) as HTMLButtonElement;
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    expect(document.activeElement).toBe(document.body);
    await act(async () => {
      stop.click();
    });
    expect(stopControl(container)).toBeNull();
    expect(document.activeElement).toBe(input(container));
  });

  it('keeps focus on the log when the reader put it there as the answer settled', async () => {
    const container = await renderShell();
    await ask(container, 'question to escape');
    const log = container.querySelector('[role="log"]') as HTMLElement;
    act(() => log.focus());
    await act(async () => {
      fire(log, new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.activeElement).toBe(log);
  });

  it('leaves focus alone when it sat on another control as the answer settled', async () => {
    const container = await renderShell();
    await ask(container, 'question to escape');
    const other = container.querySelector<HTMLElement>('.shell-toolbar button, .shell-toolbar a');
    expect(other, 'the toolbar offers a focusable control').not.toBeNull();
    act(() => other?.focus());
    await act(async () => {
      fire(other, new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await flushMicrotasks();
    await flushFrames();
    expect(stopControl(container)).toBeNull();
    expect(document.activeElement).toBe(other);
  });
});
