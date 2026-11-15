import { FORGET_OUTCOME, type ForgetResult } from '@/lib/ask/forget-request.client';
import { MS_PER_SECOND, SECONDS_PER_MINUTE } from '@/lib/time';

export const RECEIPT_VIEW = {
  Idle: 'idle',
  Confirm: 'confirm',
  Pending: 'pending',
  Unavailable: 'unavailable',
  Offline: 'offline',
  TimedOut: 'timed-out',
  Failed: 'failed',
  Waiting: 'waiting',
} as const;

type ErrorKind =
  | typeof RECEIPT_VIEW.Unavailable
  | typeof RECEIPT_VIEW.Offline
  | typeof RECEIPT_VIEW.TimedOut
  | typeof RECEIPT_VIEW.Failed;

export type ReceiptView =
  | { kind: Exclude<(typeof RECEIPT_VIEW)[keyof typeof RECEIPT_VIEW], typeof RECEIPT_VIEW.Waiting> }
  | { kind: typeof RECEIPT_VIEW.Waiting; until: number };

export const RECEIPT_ACTION = {
  Open: 'open',
  Cancel: 'cancel',
  Submit: 'submit',
  Fail: 'fail',
  Wait: 'wait',
  Expire: 'expire',
} as const;

export type ReceiptAction =
  | { type: typeof RECEIPT_ACTION.Open }
  | { type: typeof RECEIPT_ACTION.Cancel }
  | { type: typeof RECEIPT_ACTION.Submit }
  | { type: typeof RECEIPT_ACTION.Fail; kind: ErrorKind }
  | { type: typeof RECEIPT_ACTION.Wait; until: number }
  | { type: typeof RECEIPT_ACTION.Expire };

export const FALLBACK_WAIT_SECONDS = SECONDS_PER_MINUTE;

export const IDLE_VIEW: ReceiptView = { kind: RECEIPT_VIEW.Idle };

export function isErrorView(view: ReceiptView): boolean {
  return (
    view.kind === RECEIPT_VIEW.Unavailable ||
    view.kind === RECEIPT_VIEW.Offline ||
    view.kind === RECEIPT_VIEW.TimedOut ||
    view.kind === RECEIPT_VIEW.Failed
  );
}

export function receiptViewReducer(view: ReceiptView, action: ReceiptAction): ReceiptView {
  switch (action.type) {
    case RECEIPT_ACTION.Open:
      return view.kind === RECEIPT_VIEW.Idle ? { kind: RECEIPT_VIEW.Confirm } : view;
    case RECEIPT_ACTION.Cancel:
      return view.kind === RECEIPT_VIEW.Confirm ? IDLE_VIEW : view;
    case RECEIPT_ACTION.Submit:
      return view.kind === RECEIPT_VIEW.Confirm || isErrorView(view)
        ? { kind: RECEIPT_VIEW.Pending }
        : view;
    case RECEIPT_ACTION.Fail:
      return view.kind === RECEIPT_VIEW.Pending ? { kind: action.kind } : view;
    case RECEIPT_ACTION.Wait:
      return view.kind === RECEIPT_VIEW.Pending
        ? { kind: RECEIPT_VIEW.Waiting, until: action.until }
        : view;
    case RECEIPT_ACTION.Expire:
      return view.kind === RECEIPT_VIEW.Waiting ? IDLE_VIEW : view;
  }
}

export function outcomeAction(result: ForgetResult, now: number): ReceiptAction {
  switch (result.outcome) {
    case FORGET_OUTCOME.RateLimited:
      return {
        type: RECEIPT_ACTION.Wait,
        until: now + (result.retryAfter ?? FALLBACK_WAIT_SECONDS) * MS_PER_SECOND,
      };
    case FORGET_OUTCOME.Unavailable:
      return { type: RECEIPT_ACTION.Fail, kind: RECEIPT_VIEW.Unavailable };
    case FORGET_OUTCOME.Offline:
      return { type: RECEIPT_ACTION.Fail, kind: RECEIPT_VIEW.Offline };
    case FORGET_OUTCOME.TimedOut:
      return { type: RECEIPT_ACTION.Fail, kind: RECEIPT_VIEW.TimedOut };
    default:
      return { type: RECEIPT_ACTION.Fail, kind: RECEIPT_VIEW.Failed };
  }
}
