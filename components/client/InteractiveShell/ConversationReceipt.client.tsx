'use client';

import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ShellStates } from '@/content/shell-states.schema';
import { fillShellState, type ShellUi } from '@/content/shell-ui';
import { forgetWithConversation, useConversationQuestions } from '@/lib/ask-conversation.client';
import { FORGET_OUTCOME, wasForgotten } from '@/lib/forget-request.client';
import { MS_PER_MINUTE, MS_PER_SECOND, SECONDS_PER_MINUTE } from '@/lib/time';
import { COPY_STATUS, useCopyFeedback } from '@/lib/use-copy-feedback.client';
import { ShellKey } from './shell-keys';

const RECEIPT_VIEW = {
  Idle: 'idle',
  Confirm: 'confirm',
  Pending: 'pending',
  Unavailable: 'unavailable',
  Offline: 'offline',
  TimedOut: 'timed-out',
  Failed: 'failed',
  Waiting: 'waiting',
} as const;

type ReceiptView =
  | { kind: Exclude<(typeof RECEIPT_VIEW)[keyof typeof RECEIPT_VIEW], typeof RECEIPT_VIEW.Waiting> }
  | { kind: typeof RECEIPT_VIEW.Waiting; until: number };

const FALLBACK_WAIT_SECONDS = SECONDS_PER_MINUTE;
const CONFIRM_ARM_MS = 500;
const FOCUS_TARGET = { Primary: 'primary', Secondary: 'secondary' } as const;
type FocusTarget = (typeof FOCUS_TARGET)[keyof typeof FOCUS_TARGET];

function minutesLeft(until: number, now: number): number {
  return Math.max(1, Math.ceil((until - now) / MS_PER_MINUTE));
}

function LabelStack({ labels, current }: { labels: readonly string[]; current: string }) {
  const all = labels.includes(current) ? labels : [...labels, current];
  return (
    <span className="shell-label-stack" aria-hidden="true">
      {all.map((label) => (
        <span key={label} data-label="" data-current={label === current ? '' : undefined}>
          {label}
        </span>
      ))}
    </span>
  );
}

function isError(view: ReceiptView): boolean {
  return (
    view.kind === RECEIPT_VIEW.Unavailable ||
    view.kind === RECEIPT_VIEW.Offline ||
    view.kind === RECEIPT_VIEW.TimedOut ||
    view.kind === RECEIPT_VIEW.Failed
  );
}

export function ConversationReceipt({
  ui,
  states,
  requestId,
  busy,
  announce,
  onForgotten,
}: {
  ui: ShellUi;
  states: ShellStates;
  requestId: string;
  busy: boolean;
  announce: (text: string) => void;
  onForgotten: (questions: number) => void;
}) {
  const questions = Math.max(1, useConversationQuestions());
  const [view, setView] = useState<ReceiptView>({ kind: RECEIPT_VIEW.Idle });
  const [now, setNow] = useState(() => Date.now());
  const { status: copyStatus, copy } = useCopyFeedback({ resetMs: null });
  const primaryRef = useRef<HTMLButtonElement>(null);
  const secondaryRef = useRef<HTMLButtonElement>(null);
  const idRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const inFlight = useRef(false);
  const mountedRef = useRef(true);
  const confirmShownAt = useRef(0);
  const focusNext = useRef<FocusTarget | null>(null);
  const messageId = useId();

  const counted = (one: string, many: string) =>
    questions === 1 ? one : fillShellState(many, { count: String(questions) });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === FOCUS_TARGET.Primary) primaryRef.current?.focus();
    if (target === FOCUS_TARGET.Secondary) secondaryRef.current?.focus();
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: now re-arms the timer each time the minute shown in the wait changes
  useEffect(() => {
    if (view.kind !== RECEIPT_VIEW.Waiting) return;
    const remaining = view.until - Date.now();
    if (remaining <= 0) {
      setView({ kind: RECEIPT_VIEW.Idle });
      return;
    }
    const nextChange = remaining % MS_PER_MINUTE || MS_PER_MINUTE;
    const timer = setTimeout(() => setNow(Date.now()), nextChange);
    return () => clearTimeout(timer);
  }, [view, now]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new state or copy result can grow the receipt past the bottom of the scrolling log, so each change brings it back into view
  useLayoutEffect(() => {
    const root = rootRef.current;
    const feed = root?.closest<HTMLElement>('[role="log"]');
    if (!root || !feed) return;
    const overflow =
      root.getBoundingClientRect().bottom -
      (feed.getBoundingClientRect().bottom -
        Number.parseFloat(getComputedStyle(feed).paddingBottom));
    if (overflow > 0) feed.scrollTop += overflow;
  }, [view.kind, copyStatus]);

  const waitLeft =
    view.kind === RECEIPT_VIEW.Waiting
      ? `${minutesLeft(view.until, now)} ${states.minutesUnit}`
      : '';
  const confirming = view.kind === RECEIPT_VIEW.Confirm;
  const pending = view.kind === RECEIPT_VIEW.Pending;
  const forgetBlocked = pending || view.kind === RECEIPT_VIEW.Waiting || busy;

  async function runForget() {
    if (inFlight.current) return;
    inFlight.current = true;
    setView({ kind: RECEIPT_VIEW.Pending });
    announce(ui.forgetting);
    const { result } = await forgetWithConversation(requestId);
    inFlight.current = false;
    if (wasForgotten(result)) {
      onForgotten(questions);
      return;
    }
    if (!mountedRef.current) return;
    if (result.outcome === FORGET_OUTCOME.RateLimited) {
      const seconds = result.retryAfter ?? FALLBACK_WAIT_SECONDS;
      const until = Date.now() + seconds * MS_PER_SECOND;
      setNow(Date.now());
      setView({ kind: RECEIPT_VIEW.Waiting, until });
      announce(
        fillShellState(ui.forgetWaitNotice, {
          left: `${minutesLeft(until, Date.now())} ${states.minutesUnit}`,
        }),
      );
      return;
    }
    if (result.outcome === FORGET_OUTCOME.Unavailable) setView({ kind: RECEIPT_VIEW.Unavailable });
    else if (result.outcome === FORGET_OUTCOME.Offline) setView({ kind: RECEIPT_VIEW.Offline });
    else if (result.outcome === FORGET_OUTCOME.TimedOut) setView({ kind: RECEIPT_VIEW.TimedOut });
    else setView({ kind: RECEIPT_VIEW.Failed });
  }

  function selectId() {
    const node = idRef.current;
    const selection = window.getSelection();
    if (!node || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function copyId() {
    const outcome = await copy(requestId);
    if (outcome === COPY_STATUS.Pending) return;
    if (outcome === COPY_STATUS.Copied) {
      announce(ui.copiedAnnouncement);
      return;
    }
    selectId();
    announce(ui.copyFailedAnnouncement);
  }

  function cancel() {
    focusNext.current = FOCUS_TARGET.Secondary;
    setView({ kind: RECEIPT_VIEW.Idle });
  }

  function onPrimary() {
    if (pending) return;
    if (confirming) {
      cancel();
      return;
    }
    void copyId();
  }

  function onSecondary(event: MouseEvent<HTMLButtonElement>) {
    if (forgetBlocked) return;
    if (view.kind === RECEIPT_VIEW.Idle) {
      focusNext.current = FOCUS_TARGET.Primary;
      confirmShownAt.current = Date.now();
      setView({ kind: RECEIPT_VIEW.Confirm });
      return;
    }
    const pointerClick = event.detail > 0;
    if (confirming && pointerClick && Date.now() - confirmShownAt.current < CONFIRM_ARM_MS) return;
    void runForget();
  }

  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key !== ShellKey.Escape || !confirming) return;
    event.preventDefault();
    event.stopPropagation();
    cancel();
  }

  const copyFailed = copyStatus === COPY_STATUS.Failed || copyStatus === COPY_STATUS.Unavailable;
  const copyText = copyStatus === COPY_STATUS.Copied ? ui.copied : ui.copy;
  const primaryText = confirming || pending ? ui.forgetCancel : copyText;
  const primaryName = confirming || pending ? ui.forgetCancelLabel : ui.copyIdLabel;

  let secondaryText: string = ui.forget;
  let secondaryName: string = ui.forgetLabel;
  if (confirming || pending) {
    secondaryText = pending ? ui.forgetting : ui.forgetConfirm;
    secondaryName = ui.forgetConfirmLabel;
  } else if (isError(view)) {
    secondaryText = ui.forgetRetry;
    secondaryName = ui.forgetRetryLabel;
  } else if (view.kind === RECEIPT_VIEW.Waiting) {
    secondaryText = fillShellState(ui.forgetWait, { left: waitLeft });
    secondaryName = fillShellState(ui.forgetWaitLabel, { left: waitLeft });
  }

  const emailFallback = (
    <span className="shell-receipt-hint">
      {ui.forgetEmailPrefix} <a href={ui.emailHref}>{ui.email}</a>
    </span>
  );

  function renderMessage() {
    if (pending) {
      return (
        <>
          <span
            id={messageId}
            className="shell-receipt-message"
            data-tone="danger"
            data-testid="shell-receipt-message"
            role="status"
          >
            {counted(ui.forgetPendingOne, ui.forgetPendingMany)}
          </span>
          <span className="shell-receipt-progress" aria-hidden="true">
            <span />
          </span>
        </>
      );
    }
    if (isError(view)) {
      const errorCopy: Record<string, string> = {
        [RECEIPT_VIEW.Unavailable]: ui.forgetUnavailable,
        [RECEIPT_VIEW.Offline]: ui.forgetOffline,
        [RECEIPT_VIEW.TimedOut]: ui.forgetTimedOut,
      };
      const errorHint: Record<string, string> = {
        [RECEIPT_VIEW.Offline]: ui.forgetOfflineHint,
        [RECEIPT_VIEW.TimedOut]: ui.forgetTimedOutHint,
      };
      const hint = errorHint[view.kind];
      const text = errorCopy[view.kind] ?? ui.forgetFailed;
      return (
        <>
          <span
            id={messageId}
            className="shell-receipt-message"
            data-tone="danger"
            data-testid="shell-receipt-message"
            role="alert"
          >
            {text}
          </span>
          {hint === undefined ? emailFallback : <span className="shell-receipt-hint">{hint}</span>}
        </>
      );
    }
    if (view.kind === RECEIPT_VIEW.Waiting) {
      return (
        <>
          <span
            id={messageId}
            className="shell-receipt-message"
            data-tone="warning"
            data-testid="shell-receipt-message"
          >
            {fillShellState(ui.forgetWaitNotice, { left: waitLeft })}
          </span>
          <span className="shell-receipt-hint">{ui.forgetWaitHint}</span>
        </>
      );
    }
    if (copyFailed) {
      return (
        <span
          id={messageId}
          className="shell-receipt-message"
          data-tone="warning"
          data-testid="shell-receipt-message"
        >
          {ui.copyFailedAnnouncement}
        </span>
      );
    }
    return null;
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: the receipt is phrasing content inside a log line, so it groups as a span (a fieldset needs form fields); Escape bubbles here from the confirm buttons so the shell's stop key never sees it
    <span
      ref={rootRef}
      className="shell-receipt"
      data-testid="shell-receipt"
      data-state={view.kind}
      role="group"
      aria-label={ui.receiptLabel}
      aria-live="off"
      aria-busy={pending}
      onKeyDown={onKeyDown}
    >
      {confirming ? (
        <>
          <strong className="shell-receipt-title" data-tone="danger">
            {ui.forgetConfirmTitle}
          </strong>
          <span id={messageId} className="shell-receipt-body" data-testid="shell-receipt-message">
            {counted(ui.forgetConfirmOne, ui.forgetConfirmMany)}
          </span>
        </>
      ) : (
        <>
          <span className="shell-receipt-head">
            <span className="shell-receipt-title">{ui.receiptTitle}</span>
            <span className="shell-receipt-count">
              {counted(ui.receiptQuestionsOne, ui.receiptQuestionsMany)}
            </span>
            <span className="shell-receipt-retention">{ui.receiptRetention}</span>
          </span>
          <span className="shell-receipt-id">
            {ui.receiptIdLabel} <code ref={idRef}>{requestId}</code>
          </span>
          {renderMessage()}
        </>
      )}
      <span className="shell-receipt-actions">
        <button
          ref={primaryRef}
          type="button"
          className="shell-control shell-receipt-button"
          aria-label={primaryName}
          aria-disabled={pending}
          aria-describedby={confirming || pending ? messageId : undefined}
          data-copied={
            copyStatus === COPY_STATUS.Copied && !confirming && !pending ? '' : undefined
          }
          onClick={onPrimary}
        >
          <LabelStack labels={[ui.copy, ui.copied, ui.forgetCancel]} current={primaryText} />
        </button>
        <button
          ref={secondaryRef}
          type="button"
          className="shell-control shell-receipt-button shell-receipt-forget"
          aria-label={secondaryName}
          aria-disabled={forgetBlocked}
          aria-busy={pending}
          aria-describedby={confirming || isError(view) ? messageId : undefined}
          data-confirm={confirming || pending ? '' : undefined}
          onClick={onSecondary}
        >
          <LabelStack
            labels={[ui.forget, ui.forgetConfirm, ui.forgetting, ui.forgetRetry]}
            current={secondaryText}
          />
        </button>
      </span>
    </span>
  );
}
