'use client';

import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
} from 'react';
import { flushSync } from 'react-dom';
import type { ShellStates } from '@/content/shell-states.schema';
import { fillShellState, SHELL_LIMITS, type ShellUi } from '@/content/shell-ui';
import { forgetWithConversation, useConversationQuestions } from '@/lib/ask/conversation.client';
import { wasForgotten } from '@/lib/ask/forget-request.client';
import { MS_PER_MINUTE } from '@/lib/time';
import { COPY_STATUS, useCopyFeedback } from '@/lib/use-copy-feedback.client';
import { useCountdown } from '@/lib/use-countdown.client';
import {
  IDLE_VIEW,
  isErrorView,
  outcomeAction,
  RECEIPT_ACTION,
  RECEIPT_VIEW,
  type ReceiptView,
  receiptViewReducer,
} from './receipt-view';
import { revealShell } from './reveal-shell';
import { ShellEmail } from './ShellEmail';
import { ShellKey } from './shell-keys';

const MESSAGE_TONE = { Danger: 'danger', Warning: 'warning' } as const;
const MESSAGE_ROLE = { Status: 'status', Alert: 'alert' } as const;
const MESSAGE_CLASS = { Message: 'shell-receipt-message', Body: 'shell-receipt-body' } as const;

function renderMessage({
  id,
  text,
  tone,
  role,
  className = MESSAGE_CLASS.Message,
}: {
  id: string;
  text: string;
  tone?: (typeof MESSAGE_TONE)[keyof typeof MESSAGE_TONE];
  role?: (typeof MESSAGE_ROLE)[keyof typeof MESSAGE_ROLE];
  className?: string;
}) {
  return (
    <span
      id={id}
      className={className}
      data-tone={tone}
      data-testid="shell-receipt-message"
      role={role}
    >
      {text}
    </span>
  );
}

function minutesLeft(until: number, now: number): number {
  return Math.max(1, Math.ceil((until - now) / MS_PER_MINUTE));
}

function LabelStack({ labels, current }: { labels: readonly string[]; current: string }) {
  const all = labels.includes(current) ? labels : [...labels, current];
  return (
    <span className="shell-label-stack">
      {all.map((label) => (
        <span
          key={label}
          data-label=""
          data-current={label === current ? '' : undefined}
          aria-hidden={label === current ? undefined : true}
        >
          {label}
        </span>
      ))}
    </span>
  );
}

function errorCopy(kind: ReceiptView['kind'], ui: ShellUi): [string, string | undefined] {
  if (kind === RECEIPT_VIEW.Unavailable) return [ui.forgetUnavailable, undefined];
  if (kind === RECEIPT_VIEW.Offline) return [ui.forgetOffline, ui.forgetOfflineHint];
  if (kind === RECEIPT_VIEW.TimedOut) return [ui.forgetTimedOut, ui.forgetTimedOutHint];
  return [ui.forgetFailed, undefined];
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
  const [view, dispatch] = useReducer(receiptViewReducer, IDLE_VIEW);
  const now = useCountdown({
    until: view.kind === RECEIPT_VIEW.Waiting ? view.until : null,
    stepMs: MS_PER_MINUTE,
    onElapsed: () => dispatch({ type: RECEIPT_ACTION.Expire }),
  });
  const { status: copyStatus, copy } = useCopyFeedback({ resetMs: null });
  const primaryRef = useRef<HTMLButtonElement>(null);
  const secondaryRef = useRef<HTMLButtonElement>(null);
  const idRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const inFlight = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const confirmShownAt = useRef(0);
  const messageId = useId();

  const counted = (one: string, many: string) =>
    questions === 1 ? one : fillShellState(many, { count: String(questions) });

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);

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
    revealShell(root);
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
    const controller = lifetime.current;
    dispatch({ type: RECEIPT_ACTION.Submit });
    announce(ui.forgetting);
    const { result } = await forgetWithConversation(requestId);
    inFlight.current = false;
    if (wasForgotten(result)) {
      onForgotten(questions);
      return;
    }
    if (controller?.signal.aborted) return;
    const settledAt = Date.now();
    const action = outcomeAction(result, settledAt);
    dispatch(action);
    if (action.type === RECEIPT_ACTION.Wait) {
      announce(
        fillShellState(ui.forgetWaitNotice, {
          left: `${minutesLeft(action.until, settledAt)} ${states.minutesUnit}`,
        }),
      );
    }
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
    flushSync(() => dispatch({ type: RECEIPT_ACTION.Cancel }));
    secondaryRef.current?.focus();
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
      confirmShownAt.current = Date.now();
      flushSync(() => dispatch({ type: RECEIPT_ACTION.Open }));
      primaryRef.current?.focus();
      return;
    }
    const pointerClick = event.detail > 0;
    if (
      confirming &&
      pointerClick &&
      Date.now() - confirmShownAt.current < SHELL_LIMITS.confirmArmMs
    )
      return;
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

  let secondaryText: string = ui.forget;
  if (confirming || pending) secondaryText = pending ? ui.forgetting : ui.forgetConfirm;
  else if (isErrorView(view)) secondaryText = ui.forgetRetry;
  else if (view.kind === RECEIPT_VIEW.Waiting) {
    secondaryText = fillShellState(ui.forgetWait, { left: waitLeft });
  }

  const emailFallback = (
    <span className="shell-receipt-hint">
      {ui.forgetEmailPrefix} <ShellEmail ui={ui} />
    </span>
  );

  function renderFeedback() {
    if (pending) {
      return (
        <>
          {renderMessage({
            id: messageId,
            text: counted(ui.forgetPendingOne, ui.forgetPendingMany),
            tone: MESSAGE_TONE.Danger,
            role: MESSAGE_ROLE.Status,
          })}
          <span className="shell-receipt-progress" aria-hidden="true">
            <span />
          </span>
        </>
      );
    }
    if (isErrorView(view)) {
      const [text, hint] = errorCopy(view.kind, ui);
      return (
        <>
          {renderMessage({
            id: messageId,
            text,
            tone: MESSAGE_TONE.Danger,
            role: MESSAGE_ROLE.Alert,
          })}
          {hint === undefined ? emailFallback : <span className="shell-receipt-hint">{hint}</span>}
        </>
      );
    }
    if (view.kind === RECEIPT_VIEW.Waiting) {
      return (
        <>
          {renderMessage({
            id: messageId,
            text: fillShellState(ui.forgetWaitNotice, { left: waitLeft }),
            tone: MESSAGE_TONE.Warning,
          })}
          <span className="shell-receipt-hint">{ui.forgetWaitHint}</span>
        </>
      );
    }
    if (copyFailed) {
      return renderMessage({
        id: messageId,
        text: ui.copyFailedAnnouncement,
        tone: MESSAGE_TONE.Warning,
      });
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
          {renderMessage({
            id: messageId,
            text: counted(ui.forgetConfirmOne, ui.forgetConfirmMany),
            className: MESSAGE_CLASS.Body,
          })}
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
          {renderFeedback()}
        </>
      )}
      <span className="shell-receipt-actions">
        <button
          ref={primaryRef}
          type="button"
          className="btn shell-receipt-button"
          data-variant="secondary"
          data-testid="shell-receipt-primary"
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
          className="btn shell-receipt-button shell-receipt-forget"
          data-variant="secondary"
          data-testid="shell-receipt-secondary"
          aria-disabled={forgetBlocked}
          aria-busy={pending}
          aria-describedby={confirming || isErrorView(view) ? messageId : undefined}
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
