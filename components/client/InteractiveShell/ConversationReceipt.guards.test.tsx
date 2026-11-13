import { within } from '@testing-library/react';
import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { fillShellState, shellStates, shellUi } from '@/content/shell-ui';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { FORGET_OUTCOME, type ForgetResult } from '@/lib/forget-request.client';
import { describeForget } from './forget-message';

const ID = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const SECOND = '0b9d11e4-7c2a-4f6e-8e0d-2a6b9f3c1d55';
const FORGET_URL = '/api/log/forget';
const DOUBLE_CLICK_GAP_MS = 120;
const ARMED_AFTER_MS = 600;

let mounted: MountedClient | null = null;

async function setup(
  options: { locale?: SiteLocale; recordedId?: string; busy?: boolean } = {},
): Promise<{
  container: HTMLElement;
  onForgotten: ReturnType<typeof vi.fn>;
  announce: ReturnType<typeof vi.fn>;
}> {
  vi.resetModules();
  const locale = options.locale ?? SITE_LOCALE.en;
  const conversation = await import('@/lib/ask-conversation.client');
  const conversationId = conversation.conversationIdForAsk();
  conversation.recordConversationRequest(conversationId, options.recordedId ?? ID);
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

async function click(button: HTMLElement) {
  await act(async () => {
    button.click();
  });
  await flushMicrotasks();
}

async function pointerClick(button: HTMLElement, detail: number) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }));
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
const timedOut = () => Promise.reject(new DOMException('aborted', 'AbortError'));

function deferred() {
  let resolve: (value: Response) => void = () => undefined;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const message = (container: HTMLElement) =>
  container.querySelector('[data-testid="shell-receipt-message"]');

const comparable = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('ConversationReceipt guards', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });
  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('a double click never confirms', () => {
    it('ignores a pointer click that follows the opening click within the double click gap', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const fetchMock = forgetReplies(ok);
      const ui = shellUi[SITE_LOCALE.en];
      const { container, onForgotten } = await setup();
      const forget = named(container, ui.forgetLabel);
      await pointerClick(forget, 1);
      vi.advanceTimersByTime(DOUBLE_CLICK_GAP_MS);
      await pointerClick(forget, 2);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(onForgotten).not.toHaveBeenCalled();
      expect(container.textContent).toContain(ui.forgetConfirmTitle);
    });

    it('confirms on a deliberate pointer click once the question has been on screen', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const fetchMock = forgetReplies(ok);
      const ui = shellUi[SITE_LOCALE.en];
      const { container, onForgotten } = await setup();
      await pointerClick(named(container, ui.forgetLabel), 1);
      vi.advanceTimersByTime(ARMED_AFTER_MS);
      await pointerClick(named(container, ui.forgetConfirmLabel), 1);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(onForgotten).toHaveBeenCalledOnce();
    });
  });

  it('leaves the current conversation running when the forgotten request belongs to another one', async () => {
    forgetReplies(ok);
    const ui = shellUi[SITE_LOCALE.en];
    const { container, onForgotten } = await setup({ recordedId: SECOND });
    const conversation = await import('@/lib/ask-conversation.client');
    await click(named(container, ui.forgetLabel));
    await click(named(container, ui.forgetConfirmLabel));
    expect(onForgotten).toHaveBeenCalledOnce();
    expect(conversation.inConversation(SECOND)).toBe(true);
    expect(conversation.conversationQuestions()).toBe(1);
  });

  describe('announcements', () => {
    it('announces forgetting when the deletion starts', async () => {
      const reply = deferred();
      forgetReplies(() => reply.promise);
      const ui = shellUi[SITE_LOCALE.en];
      const { container, announce } = await setup();
      await click(named(container, ui.forgetLabel));
      await click(named(container, ui.forgetConfirmLabel));
      expect(announce).toHaveBeenCalledWith(ui.forgetting);
      await act(async () => reply.resolve(Response.json({ ok: true })));
      await flushMicrotasks();
    });

    it('stays quiet when the rate limit answer arrives after the receipt is gone', async () => {
      const reply = deferred();
      forgetReplies(() => reply.promise);
      const ui = shellUi[SITE_LOCALE.en];
      const { container, announce } = await setup();
      await click(named(container, ui.forgetLabel));
      await click(named(container, ui.forgetConfirmLabel));
      mounted?.unmount();
      mounted = null;
      announce.mockClear();
      await act(async () =>
        reply.resolve(
          Response.json({ ok: false }, { status: 429, headers: { 'Retry-After': '90' } }),
        ),
      );
      await flushMicrotasks();
      expect(announce).not.toHaveBeenCalled();
    });
  });

  describe('failures', () => {
    it('on a server timeout says the conversation may be gone and offers a retry', async () => {
      const fetchMock = forgetReplies(timedOut, ok);
      const ui = shellUi[SITE_LOCALE.en];
      const { container, onForgotten } = await setup();
      await click(named(container, ui.forgetLabel));
      await click(named(container, ui.forgetConfirmLabel));
      expect(message(container)?.textContent).toBe(ui.forgetTimedOut);
      expect(message(container)?.getAttribute('role')).toBe('alert');
      expect(container.textContent).toContain(ui.forgetTimedOutHint);
      expect(container.textContent).not.toContain(ui.forgetOffline);
      await click(named(container, ui.forgetRetryLabel));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(onForgotten).toHaveBeenCalledOnce();
    });

    it('on a server error keeps the receipt with the generic failure, the email fallback and a retry', async () => {
      const fetchMock = forgetReplies(status(500), ok);
      const ui = shellUi[SITE_LOCALE.en];
      const { container, onForgotten } = await setup();
      await click(named(container, ui.forgetLabel));
      await click(named(container, ui.forgetConfirmLabel));
      expect(message(container)?.textContent).toBe(ui.forgetFailed);
      expect(message(container)?.getAttribute('role')).toBe('alert');
      expect(container.textContent).toContain(ui.forgetEmailPrefix);
      expect(onForgotten).not.toHaveBeenCalled();
      await click(named(container, ui.forgetRetryLabel));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(onForgotten).toHaveBeenCalledOnce();
    });
  });

  describe('each button name contains its visible text (WCAG 2.5.3)', () => {
    function expectNamesToContainVisibleText(container: HTMLElement) {
      const buttons = within(container).getAllByRole('button');
      expect(buttons).toHaveLength(2);
      for (const button of buttons) {
        const visible = comparable(button.querySelector('[data-current]')?.textContent ?? '');
        expect(visible).not.toBe('');
        const match = within(container).getByRole('button', {
          name: (accessibleName) => comparable(accessibleName).includes(visible),
        });
        expect(match, `no accessible name contains "${visible}"`).toBeDefined();
        expect(comparable(button.getAttribute('aria-label') ?? '')).toContain(visible);
      }
    }

    it.each([SITE_LOCALE.en, SITE_LOCALE.pt] as const)(
      'in %s through idle, copied, confirm, deleting, errors and the wait',
      async (locale) => {
        const ui = shellUi[locale];
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
        forgetReplies(status(503), timedOut, status(500), status(429, { 'Retry-After': '150' }));
        const { container } = await setup({ locale });
        expectNamesToContainVisibleText(container);

        await click(within(container).getAllByRole('button')[0] as HTMLElement);
        expectNamesToContainVisibleText(container);

        await click(named(container, ui.forgetLabel));
        expectNamesToContainVisibleText(container);

        await click(named(container, ui.forgetConfirmLabel));
        expectNamesToContainVisibleText(container);

        for (let attempt = 0; attempt < 3; attempt++) {
          await click(named(container, ui.forgetRetryLabel));
          expectNamesToContainVisibleText(container);
        }
      },
    );

    it('while the deletion is pending', async () => {
      const reply = deferred();
      forgetReplies(() => reply.promise);
      const ui = shellUi[SITE_LOCALE.pt];
      const { container } = await setup({ locale: SITE_LOCALE.pt });
      await click(named(container, ui.forgetLabel));
      await click(named(container, ui.forgetConfirmLabel));
      expectNamesToContainVisibleText(container);
      await act(async () => reply.resolve(Response.json({ ok: true })));
      await flushMicrotasks();
    });

    it('while the rate limit wait counts down', async () => {
      forgetReplies(status(429, { 'Retry-After': '150' }));
      const ui = shellUi[SITE_LOCALE.en];
      const { container } = await setup();
      await click(named(container, ui.forgetLabel));
      await click(named(container, ui.forgetConfirmLabel));
      expect(
        named(
          container,
          fillShellState(ui.forgetWaitLabel, { left: `3 ${shellStates.en.minutesUnit}` }),
        ),
      ).toBeDefined();
      expectNamesToContainVisibleText(container);
    });
  });
});

describe('describeForget', () => {
  const states = shellStates[SITE_LOCALE.en];
  const ui = shellUi[SITE_LOCALE.en];
  const sample: Record<(typeof FORGET_OUTCOME)[keyof typeof FORGET_OUTCOME], ForgetResult> = {
    [FORGET_OUTCOME.Deleted]: { outcome: FORGET_OUTCOME.Deleted },
    [FORGET_OUTCOME.RateLimited]: { outcome: FORGET_OUTCOME.RateLimited, retryAfter: 30 },
    [FORGET_OUTCOME.Unavailable]: { outcome: FORGET_OUTCOME.Unavailable },
    [FORGET_OUTCOME.Offline]: { outcome: FORGET_OUTCOME.Offline },
    [FORGET_OUTCOME.TimedOut]: { outcome: FORGET_OUTCOME.TimedOut },
    [FORGET_OUTCOME.Failed]: { outcome: FORGET_OUTCOME.Failed },
  };

  it('gives every outcome its own wording, never the generic failure for another outcome', () => {
    const lines = Object.values(sample).map((result) => describeForget(result, ui, states));
    expect(lines.every((line) => typeof line === 'string' && line.length > 0)).toBe(true);
    expect(new Set(lines).size).toBe(Object.keys(FORGET_OUTCOME).length);
    expect(describeForget(sample[FORGET_OUTCOME.TimedOut], ui, states)).toBe(ui.forgetTimedOut);
  });
});
