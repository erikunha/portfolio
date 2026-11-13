import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fire, flushMicrotasks, type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { fillShellState, shellStates, shellUi } from '@/content/shell-ui';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';

const ID = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const SECOND = '0b9d11e4-7c2a-4f6e-8e0d-2a6b9f3c1d55';
const FORGET_URL = '/api/log/forget';

let mounted: MountedClient | null = null;

async function setup(
  options: { locale?: SiteLocale; questions?: number; busy?: boolean } = {},
): Promise<{
  container: HTMLElement;
  onForgotten: ReturnType<typeof vi.fn>;
  announce: ReturnType<typeof vi.fn>;
}> {
  vi.resetModules();
  const locale = options.locale ?? SITE_LOCALE.en;
  const conversation = await import('@/lib/ask-conversation.client');
  const id = conversation.conversationIdForAsk() ?? '';
  const answered = [SECOND, ID].slice(-(options.questions ?? 1));
  for (const requestId of answered) conversation.recordConversationRequest(id, requestId);
  const { ConversationReceipt } = await import('./ConversationReceipt.client');
  const onForgotten = vi.fn();
  const announce = vi.fn();
  mounted = await mountClient(
    createElement(ConversationReceipt, {
      ui: shellUi[locale],
      states: shellStates[locale],
      requestId: ID,
      busy: options.busy ?? false,
      announce,
      onForgotten,
    }),
  );
  return { container: mounted.container, onForgotten, announce };
}

function named(container: HTMLElement, name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(
    (button) => button.getAttribute('aria-label') === name,
  );
  if (!found) throw new Error(`no button named ${name}`);
  return found;
}

const has = (container: HTMLElement, name: string) =>
  [...container.querySelectorAll('button')].some((b) => b.getAttribute('aria-label') === name);

async function click(button: HTMLElement) {
  await act(async () => {
    button.click();
  });
  await flushMicrotasks();
}

function forgetReplies(...replies: (() => Promise<Response>)[]) {
  const queue = [...replies];
  const fetchMock = vi.fn(async (url: string) => {
    if (url !== FORGET_URL) throw new Error(`unexpected ${url}`);
    const next = queue.shift();
    if (!next) throw new Error('no reply queued');
    return next();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const ok = () => Promise.resolve(Response.json({ ok: true }));
const status =
  (code: number, headers: Record<string, string> = {}) =>
  () =>
    Promise.resolve(Response.json({ ok: false }, { status: code, headers }));
const offline = () => Promise.reject(new TypeError('Failed to fetch'));

const ui = shellUi[SITE_LOCALE.en];
const message = (container: HTMLElement) =>
  container.querySelector('[data-testid="shell-receipt-message"]');

async function confirmForget(container: HTMLElement) {
  await click(named(container, ui.forgetLabel));
  await click(named(container, ui.forgetConfirmLabel));
}

describe('ConversationReceipt', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });
  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shows the title, question count, retention, the full latest id and two named buttons', async () => {
    const { container } = await setup({ questions: 2 });
    const receipt = container.querySelector('[data-testid="shell-receipt"]');
    expect(receipt?.textContent).toContain(ui.receiptTitle);
    expect(receipt?.textContent).toContain(fillShellState(ui.receiptQuestionsMany, { count: '2' }));
    expect(receipt?.textContent).toContain(ui.receiptRetention);
    expect(receipt?.querySelector('code')?.textContent).toBe(ID);
    expect(has(container, ui.copyIdLabel)).toBe(true);
    expect(has(container, ui.forgetLabel)).toBe(true);
    expect(receipt?.getAttribute('aria-live')).toBe('off');
  });

  it('uses the singular for one question and the pt-BR copy', async () => {
    const { container } = await setup({ locale: SITE_LOCALE.pt, questions: 1 });
    const pt = shellUi[SITE_LOCALE.pt];
    expect(container.textContent).toContain(pt.receiptQuestionsOne);
    expect(has(container, pt.copyIdLabel)).toBe(true);
    expect(has(container, pt.forgetLabel)).toBe(true);
  });

  it('asks to confirm in place, with focus on cancel, and sends nothing yet', async () => {
    const fetchMock = forgetReplies(ok);
    const { container } = await setup({ questions: 2 });
    await click(named(container, ui.forgetLabel));
    expect(message(container)?.textContent).toBe(
      fillShellState(ui.forgetConfirmMany, { count: '2' }),
    );
    expect(container.textContent).toContain(ui.forgetConfirmTitle);
    expect(document.activeElement).toBe(named(container, ui.forgetCancelLabel));
    expect(has(container, ui.forgetConfirmLabel)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cancels the confirm step with cancel or Escape and returns focus to forget', async () => {
    forgetReplies(ok);
    const { container } = await setup();
    await click(named(container, ui.forgetLabel));
    await click(named(container, ui.forgetCancelLabel));
    expect(message(container)).toBeNull();
    expect(document.activeElement).toBe(named(container, ui.forgetLabel));

    await click(named(container, ui.forgetLabel));
    const escapeKey = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    fire(document.activeElement, escapeKey);
    await flushMicrotasks();
    expect(escapeKey.defaultPrevented).toBe(true);
    expect(message(container)).toBeNull();
    expect(has(container, ui.forgetLabel)).toBe(true);
  });

  it('marks forgetting as busy with a status line, both buttons disabled', async () => {
    let release: (value: Response) => void = () => undefined;
    forgetReplies(() => new Promise<Response>((resolve) => (release = resolve)));
    const { container } = await setup();
    await confirmForget(container);
    const pending = named(container, ui.forgetConfirmLabel);
    expect(pending.getAttribute('aria-busy')).toBe('true');
    expect(pending.getAttribute('aria-disabled')).toBe('true');
    expect(pending.textContent).toContain(ui.forgetting);
    expect(named(container, ui.forgetCancelLabel).getAttribute('aria-disabled')).toBe('true');
    expect(message(container)?.getAttribute('role')).toBe('status');
    expect(message(container)?.textContent).toBe(ui.forgetPendingOne);
    expect(container.querySelector('.shell-receipt-progress')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="shell-receipt"]')?.getAttribute('aria-busy'),
    ).toBe('true');
    await act(async () => release(Response.json({ ok: true })));
    await flushMicrotasks();
  });

  it('on success reports the conversation as forgotten and starts a new conversation', async () => {
    forgetReplies(ok);
    const { container, onForgotten } = await setup();
    const conversation = await import('@/lib/ask-conversation.client');
    await confirmForget(container);
    expect(onForgotten).toHaveBeenCalledWith(1);
    expect(conversation.conversationQuestions()).toBe(0);
  });

  it('on 503 keeps the receipt with a storage alert, retry and the email fallback', async () => {
    const fetchMock = forgetReplies(status(503), ok);
    const { container, onForgotten } = await setup();
    await confirmForget(container);
    const alert = message(container);
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toBe(ui.forgetUnavailable);
    const receipt = container.querySelector('[data-testid="shell-receipt"]');
    expect(receipt?.textContent).toContain(ui.forgetEmailPrefix);
    expect(receipt?.querySelector(`a[href="${ui.emailHref}"]`)).not.toBeNull();
    expect(onForgotten).not.toHaveBeenCalled();
    await click(named(container, ui.forgetRetryLabel));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onForgotten).toHaveBeenCalledOnce();
  });

  it('on a lost connection says nothing was deleted and offers retry', async () => {
    forgetReplies(offline);
    const { container } = await setup();
    await confirmForget(container);
    expect(message(container)?.textContent).toBe(ui.forgetOffline);
    expect(message(container)?.getAttribute('role')).toBe('alert');
    expect(container.textContent).toContain(ui.forgetOfflineHint);
    expect(has(container, ui.forgetRetryLabel)).toBe(true);
  });

  it('on 429 counts down in minutes with forget disabled and labelled with the wait, then enables it again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    forgetReplies(status(429, { 'Retry-After': '150' }));
    const { container, announce } = await setup();
    await confirmForget(container);
    const states = shellStates[SITE_LOCALE.en];
    const three = `3 ${states.minutesUnit}`;
    expect(message(container)?.textContent).toBe(
      fillShellState(ui.forgetWaitNotice, { left: three }),
    );
    expect(container.textContent).toContain(ui.forgetWaitHint);
    expect(announce).toHaveBeenCalledWith(message(container)?.textContent);
    const waiting = named(container, fillShellState(ui.forgetWaitLabel, { left: three }));
    expect(waiting.getAttribute('aria-disabled')).toBe('true');
    expect(waiting.querySelector('[data-current]')?.textContent).toBe(
      fillShellState(ui.forgetWait, { left: three }),
    );
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });
    expect(message(container)?.textContent).toContain(`2 ${states.minutesUnit}`);
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    expect(message(container)).toBeNull();
    expect(named(container, ui.forgetLabel).getAttribute('aria-disabled')).toBe('false');
  });

  it('keeps forget disabled while another answer streams', async () => {
    const fetchMock = forgetReplies(ok);
    const { container } = await setup({ busy: true });
    const forget = named(container, ui.forgetLabel);
    expect(forget.getAttribute('aria-disabled')).toBe('true');
    await click(forget);
    expect(message(container)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reserves every label of each button, so feedback never changes its width', async () => {
    const { container } = await setup();
    const copy = named(container, ui.copyIdLabel);
    const stacked = [...copy.querySelectorAll('[data-label]')].map((node) => node.textContent);
    expect(stacked).toEqual(expect.arrayContaining([ui.copy, ui.copied, ui.forgetCancel]));
    const forget = named(container, ui.forgetLabel);
    const reserved = [...forget.querySelectorAll('[data-label]')].map((node) => node.textContent);
    expect(reserved).toEqual(
      expect.arrayContaining([ui.forget, ui.forgetConfirm, ui.forgetting, ui.forgetRetry]),
    );
  });

  it('shows copied, and on a denied clipboard selects the id and says so', async () => {
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('no'));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const { container, announce } = await setup();
    await click(named(container, ui.copyIdLabel));
    expect(writeText).toHaveBeenCalledWith(ID);
    expect(named(container, ui.copyIdLabel).querySelector('[data-current]')?.textContent).toBe(
      ui.copied,
    );
    expect(announce).toHaveBeenCalledWith(ui.copiedAnnouncement);
    await click(named(container, ui.copyIdLabel));
    expect(message(container)?.textContent).toBe(ui.copyFailedAnnouncement);
    expect(window.getSelection()?.toString()).toBe(ID);
    expect(announce).toHaveBeenCalledWith(ui.copyFailedAnnouncement);
  });
});
