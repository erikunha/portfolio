'use client';

import type { ShellUi } from '@/content/shell-ui';
import { COPY_STATUS, useCopyFeedback } from '@/lib/use-copy-feedback.client';

export function ResponseReference({
  ui,
  requestId,
  announce,
}: {
  ui: ShellUi;
  requestId: string;
  announce: (text: string) => void;
}) {
  const { status, copy } = useCopyFeedback({ resetMs: null });
  async function copyReference() {
    const outcome = await copy(requestId);
    if (outcome === COPY_STATUS.Pending) return;
    announce(outcome === COPY_STATUS.Copied ? ui.copiedAnnouncement : ui.copyFailedAnnouncement);
  }
  const label =
    status === COPY_STATUS.Copied
      ? ui.copied
      : status === COPY_STATUS.Failed || status === COPY_STATUS.Unavailable
        ? ui.copyFailed
        : ui.copy;
  return (
    <span className="shell-reference" data-testid="shell-reference">
      <span>
        {ui.referencePrefix} <code>{requestId}</code>
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
    </span>
  );
}
