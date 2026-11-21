import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { shellStates, shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { FORGET_OUTCOME, type ForgetResult } from '@/lib/ask/forget-request.client';
import { MS_PER_SECOND } from '@/lib/time';
import {
  FALLBACK_WAIT_SECONDS,
  isErrorView,
  outcomeAction,
  RECEIPT_ACTION,
  RECEIPT_VIEW,
  type ReceiptAction,
  type ReceiptView,
  receiptViewReducer,
} from './receipt-view';

const NOW = 1_000_000;
const UNTIL = NOW + 90 * MS_PER_SECOND;

const idle: ReceiptView = { kind: RECEIPT_VIEW.Idle };
const confirm: ReceiptView = { kind: RECEIPT_VIEW.Confirm };
const pending: ReceiptView = { kind: RECEIPT_VIEW.Pending };
const waiting: ReceiptView = { kind: RECEIPT_VIEW.Waiting, until: UNTIL };
const errors: ReceiptView[] = [
  { kind: RECEIPT_VIEW.Unavailable },
  { kind: RECEIPT_VIEW.Offline },
  { kind: RECEIPT_VIEW.TimedOut },
  { kind: RECEIPT_VIEW.Failed },
];

const open: ReceiptAction = { type: RECEIPT_ACTION.Open };
const cancel: ReceiptAction = { type: RECEIPT_ACTION.Cancel };
const submit: ReceiptAction = { type: RECEIPT_ACTION.Submit };
const expire: ReceiptAction = { type: RECEIPT_ACTION.Expire };

describe('receiptViewReducer', () => {
  it.each([
    ['open from idle asks to confirm', idle, open, confirm],
    ['open from confirm changes nothing', confirm, open, confirm],
    ['open while pending changes nothing', pending, open, pending],
    ['open while waiting changes nothing', waiting, open, waiting],
    ['cancel from confirm returns to idle', confirm, cancel, idle],
    ['cancel while pending changes nothing', pending, cancel, pending],
    ['cancel from idle changes nothing', idle, cancel, idle],
    ['submit from confirm goes pending', confirm, submit, pending],
    ['submit from idle changes nothing', idle, submit, idle],
    ['submit while pending changes nothing', pending, submit, pending],
    ['submit while waiting changes nothing', waiting, submit, waiting],
    ['expire from waiting returns to idle', waiting, expire, idle],
    ['expire from confirm changes nothing', confirm, expire, confirm],
    ['expire from idle changes nothing', idle, expire, idle],
  ] as const)('%s', (_name, from, action, to) => {
    expect(receiptViewReducer(from, action)).toEqual(to);
  });

  it.each(errors)('submit retries from the $kind error', (from) => {
    expect(receiptViewReducer(from, submit)).toEqual(pending);
  });

  it.each([
    [RECEIPT_VIEW.Unavailable],
    [RECEIPT_VIEW.Offline],
    [RECEIPT_VIEW.TimedOut],
    [RECEIPT_VIEW.Failed],
  ] as const)('a pending forget that fails as %s shows that error', (kind) => {
    expect(receiptViewReducer(pending, { type: RECEIPT_ACTION.Fail, kind })).toEqual({ kind });
  });

  it('a pending forget that is rate limited waits until the deadline', () => {
    expect(receiptViewReducer(pending, { type: RECEIPT_ACTION.Wait, until: UNTIL })).toEqual(
      waiting,
    );
  });

  it('a settled result outside a pending forget changes nothing', () => {
    const fail: ReceiptAction = { type: RECEIPT_ACTION.Fail, kind: RECEIPT_VIEW.Offline };
    const wait: ReceiptAction = { type: RECEIPT_ACTION.Wait, until: UNTIL };
    for (const from of [idle, confirm, waiting, ...errors]) {
      expect(receiptViewReducer(from, fail)).toBe(from);
      expect(receiptViewReducer(from, wait)).toBe(from);
    }
  });
});

describe('outcomeAction', () => {
  it.each([
    [FORGET_OUTCOME.Unavailable, RECEIPT_VIEW.Unavailable],
    [FORGET_OUTCOME.Offline, RECEIPT_VIEW.Offline],
    [FORGET_OUTCOME.TimedOut, RECEIPT_VIEW.TimedOut],
    [FORGET_OUTCOME.Failed, RECEIPT_VIEW.Failed],
  ] as const)('maps the %s outcome to the %s view', (outcome, kind) => {
    expect(outcomeAction({ outcome } as ForgetResult, NOW)).toEqual({
      type: RECEIPT_ACTION.Fail,
      kind,
    });
  });

  it('waits for the server Retry-After seconds from now', () => {
    const result: ForgetResult = { outcome: FORGET_OUTCOME.RateLimited, retryAfter: 90 };
    expect(outcomeAction(result, NOW)).toEqual({ type: RECEIPT_ACTION.Wait, until: UNTIL });
  });

  it('waits the fallback seconds when the server gave no Retry-After', () => {
    const result: ForgetResult = { outcome: FORGET_OUTCOME.RateLimited, retryAfter: null };
    expect(outcomeAction(result, NOW)).toEqual({
      type: RECEIPT_ACTION.Wait,
      until: NOW + FALLBACK_WAIT_SECONDS * MS_PER_SECOND,
    });
  });
});

describe('isErrorView', () => {
  it.each(errors)('treats $kind as an error', (view) => {
    expect(isErrorView(view)).toBe(true);
  });

  it.each([idle, confirm, pending, waiting])('does not treat $kind as an error', (view) => {
    expect(isErrorView(view)).toBe(false);
  });
});

describe('ConversationReceipt unmounted during a pending forget', () => {
  const REQUEST_ID = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
  const RETRY_AFTER_SECONDS = '120';
  const ui = shellUi[SITE_LOCALE.en];
  let mounted: MountedClient | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.unstubAllGlobals();
  });

  it('does not announce the wait once the receipt is gone', async () => {
    window.sessionStorage.clear();
    vi.resetModules();
    let reply: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            reply = resolve;
          }),
      ),
    );
    const conversation = await import('@/lib/ask/conversation.client');
    conversation.recordConversationRequest(conversation.conversationIdForAsk() ?? '', REQUEST_ID);
    const { ConversationReceipt } = await import('./ConversationReceipt.client');
    const announce = vi.fn();
    const onForgotten = vi.fn();
    const view = await mountClient(
      createElement(ConversationReceipt, {
        ui,
        states: shellStates[SITE_LOCALE.en],
        requestId: REQUEST_ID,
        busy: false,
        announce,
        onForgotten,
      }),
    );
    mounted = view;
    const press = async (name: string) => {
      const button = [...view.container.querySelectorAll('button')].find((candidate) =>
        candidate.textContent?.includes(name),
      );
      await act(async () => {
        button?.click();
      });
      await flushMicrotasks();
    };
    await press(ui.forget);
    await press(ui.forgetConfirm);
    expect(announce).toHaveBeenCalledExactlyOnceWith(ui.forgetting);

    view.unmount();
    mounted = null;
    await act(async () => {
      reply(
        Response.json(
          { ok: false },
          { status: 429, headers: { 'Retry-After': RETRY_AFTER_SECONDS } },
        ),
      );
    });
    await flushMicrotasks();

    expect(announce).toHaveBeenCalledExactlyOnceWith(ui.forgetting);
    expect(onForgotten).not.toHaveBeenCalled();
  });
});
