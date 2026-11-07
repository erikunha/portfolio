'use client';

import type { HTMLAttributes } from 'react';
import type { CopyFeedback, CopyFeedbackState } from '@/content/schemas';
import { COPY_STATUS, type CopyStatus, useCopyFeedback } from '@/lib/use-copy-feedback.client';

export const REF_COPY_RESET_MS = 2000;

type RefFeedback = Record<CopyFeedbackState, CopyFeedback>;
type RefLabels = { readonly copy: string; readonly copied: string };

export function RefCopyButton({
  value,
  feedback,
  labels,
  className,
}: {
  value: string;
  feedback: RefFeedback;
  labels?: RefLabels;
  className?: string;
}) {
  const { status, attempt, copy } = useCopyFeedback({ resetMs: REF_COPY_RESET_MS });
  const byStatus: Record<CopyStatus, CopyFeedback> = {
    [COPY_STATUS.Idle]: { label: labels?.copy ?? feedback.idle.label, message: '' },
    [COPY_STATUS.Pending]: { label: labels?.copy ?? feedback.idle.label, message: '' },
    [COPY_STATUS.Copied]: {
      label: labels?.copied ?? feedback.success.label,
      message: feedback.success.message,
    },
    [COPY_STATUS.Failed]: feedback.failure,
    [COPY_STATUS.Unavailable]: feedback.unavailable,
  };
  const current = byStatus[status];
  return (
    <>
      <button
        type="button"
        className={className ? `ref-copy ${className}` : 'ref-copy'}
        onClick={() => void copy(value)}
      >
        {current.label}
      </button>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        <span key={attempt}>{current.message}</span>
      </span>
    </>
  );
}

export function RefChip({
  value,
  prefix,
  feedback,
  labels,
  className,
  ...rest
}: {
  value: string;
  prefix: string;
  feedback: RefFeedback;
  labels?: RefLabels;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children'>) {
  return (
    <div {...rest} className={className ? `ref-chip ${className}` : 'ref-chip'}>
      <span className="ref-chip-prefix">{prefix}</span>
      <code className="ref-chip-id" title={value}>
        {value}
      </code>
      <RefCopyButton value={value} feedback={feedback} labels={labels} />
    </div>
  );
}
