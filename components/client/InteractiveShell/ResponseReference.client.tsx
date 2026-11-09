'use client';

import { useEffect, useRef, useState } from 'react';
import type { ShellStates } from '@/content/shell-states.schema';
import type { ShellUi } from '@/content/shell-ui';
import { forgetRequest, wasForgotten } from '@/lib/forget-request.client';
import { COPY_STATUS, type CopyStatus, useCopyFeedback } from '@/lib/use-copy-feedback.client';
import { describeForget } from './forget-message';

const FORGET_VIEW = { Idle: 'idle', Pending: 'pending', Settled: 'settled' } as const;
type ForgetView =
  | { kind: typeof FORGET_VIEW.Idle }
  | { kind: typeof FORGET_VIEW.Pending }
  | { kind: typeof FORGET_VIEW.Settled; message: string; forgotten: boolean };

function copyLabel(status: CopyStatus, ui: ShellUi): string {
  if (status === COPY_STATUS.Copied) return ui.copied;
  if (status === COPY_STATUS.Failed || status === COPY_STATUS.Unavailable) return ui.copyFailed;
  return ui.copy;
}

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
  const forgetButton = useRef<HTMLButtonElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

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
    restoreFocus.current = wasForgotten(result) && document.activeElement === forgetButton.current;
    const message = describeForget(result, ui, states);
    setForget({ kind: FORGET_VIEW.Settled, message, forgotten: wasForgotten(result) });
    announce(message);
  }

  const label = copyLabel(status, ui);
  const forgotten = forget.kind === FORGET_VIEW.Settled && forget.forgotten;
  const forgetPendingView = forget.kind === FORGET_VIEW.Pending;

  useEffect(() => {
    if (forgotten && restoreFocus.current) copyButton.current?.focus();
  }, [forgotten]);

  return (
    <span className="shell-reference" data-testid="shell-reference">
      <span>
        {ui.trailerPrefix}
        <code>{requestId}</code>
      </span>
      <button
        ref={copyButton}
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
          ref={forgetButton}
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
