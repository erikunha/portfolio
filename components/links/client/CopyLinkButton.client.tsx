'use client';

import { COPY_STATUS, type CopyStatus, useCopyFeedback } from '@/lib/use-copy-feedback.client';
import { IconCopy } from '../LinkIcons';

export function CopyLinkButton({
  url,
  idleLabel,
  doneLabel,
  failedLabel,
  failedMessage,
}: {
  url: string;
  idleLabel: string;
  doneLabel: string;
  failedLabel: string;
  failedMessage: string;
}) {
  const { status, copy } = useCopyFeedback({ resetOnFailure: true });
  const labelByStatus: Record<CopyStatus, string> = {
    [COPY_STATUS.Idle]: idleLabel,
    [COPY_STATUS.Pending]: idleLabel,
    [COPY_STATUS.Copied]: doneLabel,
    [COPY_STATUS.Failed]: failedLabel,
    [COPY_STATUS.Unavailable]: failedLabel,
  };
  const label = labelByStatus[status];
  const showingOutcome =
    status === COPY_STATUS.Copied ||
    status === COPY_STATUS.Failed ||
    status === COPY_STATUS.Unavailable;

  return (
    <>
      <button
        type="button"
        aria-label={idleLabel}
        onClick={() => void copy(url)}
        className="links-pill"
      >
        <span className="links-pill-glyph" aria-hidden="true">
          <IconCopy />
        </span>
        <span aria-hidden="true">{showingOutcome ? `$ ${label}` : label}</span>
      </button>
      <span className="sr-only" role="status">
        {status === COPY_STATUS.Failed || status === COPY_STATUS.Unavailable
          ? failedMessage
          : label}
      </span>
    </>
  );
}
