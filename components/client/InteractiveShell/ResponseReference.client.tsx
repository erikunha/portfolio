'use client';

import { useRef, useState } from 'react';
import type { ShellStates } from '@/content/shell-states.schema';
import type { ShellUi } from '@/content/shell-ui';
import { forgetRequest, wasForgotten } from '@/lib/forget-request.client';
import { COPY_STATUS, useCopyFeedback } from '@/lib/use-copy-feedback.client';
import { describeForget } from './forget-message';

const FORGET_VIEW = { Idle: 'idle', Pending: 'pending', Settled: 'settled' } as const;
type ForgetView =
  | { kind: typeof FORGET_VIEW.Idle }
  | { kind: typeof FORGET_VIEW.Pending }
  | { kind: typeof FORGET_VIEW.Settled; message: string; forgotten: boolean };

export function ResponseReference({
  ui,
  states,
  requestId,
  announce,
}: {
  ui: ShellUi;
  states: ShellStates;
  requestId: string;
  announce: (text: string) => void;
}) {
  const { status, copy } = useCopyFeedback({ resetMs: null });
  const [forget, setForget] = useState<ForgetView>({ kind: FORGET_VIEW.Idle });
  const forgetPending = useRef(false);

  async function copyReference() {
    const outcome = await copy(requestId);
    if (outcome === COPY_STATUS.Pending) return;
    announce(outcome === COPY_STATUS.Copied ? ui.copiedAnnouncement : ui.copyFailedAnnouncement);
  }

  async function forgetReference() {
    if (forgetPending.current) return;
    forgetPending.current = true;
    setForget({ kind: FORGET_VIEW.Pending });
    const result = await forgetRequest(requestId);
    forgetPending.current = false;
    const message = describeForget(result, ui, states);
    setForget({ kind: FORGET_VIEW.Settled, message, forgotten: wasForgotten(result) });
    announce(message);
  }

  const label =
    status === COPY_STATUS.Copied
      ? ui.copied
      : status === COPY_STATUS.Failed || status === COPY_STATUS.Unavailable
        ? ui.copyFailed
        : ui.copy;
  const forgotten = forget.kind === FORGET_VIEW.Settled && forget.forgotten;
  const forgetPendingView = forget.kind === FORGET_VIEW.Pending;

  return (
    <span className="shell-reference" data-testid="shell-reference">
      <span>
        {ui.trailerPrefix}
        <code>{requestId}</code>
      </span>
      <button
        type="button"
        className="shell-control"
        aria-label={`${label} ${ui.referencePrefix} ${requestId}`}
        aria-disabled={status === COPY_STATUS.Pending}
        onClick={copyReference}
      >
        {label}
      </button>
      {!forgotten && (
        <button
          type="button"
          className="shell-control"
          aria-label={`${ui.forget} ${ui.referencePrefix} ${requestId}`}
          aria-disabled={forgetPendingView}
          onClick={forgetReference}
        >
          {forgetPendingView ? ui.forgetting : ui.forget}
        </button>
      )}
      {forget.kind === FORGET_VIEW.Settled && (
        <span className="shell-trailer-status">{forget.message}</span>
      )}
    </span>
  );
}
