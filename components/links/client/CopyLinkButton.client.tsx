'use client';

import { COPY_STATUS, type CopyStatus, useCopyFeedback } from '@/lib/use-copy-feedback.client';
import { IconCopy } from '../LinkIcons';

export function CopyLinkButton({
  url,
  idleLabel,
  doneLabel,
  failedLabel,
}: {
  url: string;
  idleLabel: string;
  doneLabel: string;
  failedLabel: string;
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
        className="inline-flex items-center gap-[7px] border border-primary-subtle px-3 min-h-11 w-full bg-transparent text-primary-500 font-mono font-bold text-xs tracking-[0.1em] uppercase cursor-pointer transition-[box-shadow,background] duration-200 ease-out hover:shadow-[0_0_12px_var(--color-primary-500)] hover:bg-primary-quiet focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
      >
        <span className="text-primary-400" aria-hidden="true">
          <IconCopy />
        </span>
        <span aria-hidden="true">{showingOutcome ? `$ ${label}` : label}</span>
      </button>
      <span className="sr-only" role="status">
        {label}
      </span>
    </>
  );
}
