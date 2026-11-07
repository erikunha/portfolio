'use client';

import { type Ref, useMemo } from 'react';
import type { CopyFeedback } from '@/content/schemas';
import { COPY_STATUS, type CopyStatus, useCopyFeedback } from '@/lib/use-copy-feedback.client';

const DEFAULT_CLASS = 'copy-btn contact-copy-btn';

export function ContactCopyButton({
  value,
  labels,
  feedback,
  className = DEFAULT_CLASS,
  resetMs,
  buttonRef,
}: {
  value: string;
  labels: { readonly copy: string; readonly copied: string };
  feedback: {
    readonly idle: CopyFeedback;
    readonly success: CopyFeedback;
    readonly failure: CopyFeedback;
    readonly unavailable: CopyFeedback;
  };
  className?: string;
  resetMs?: number;
  buttonRef?: Ref<HTMLButtonElement> | undefined;
}) {
  const { status, attempt, copy } = useCopyFeedback(resetMs === undefined ? {} : { resetMs });
  const byStatus = useMemo<Record<CopyStatus, CopyFeedback>>(() => {
    const idle: CopyFeedback = { label: labels.copy, message: '' };
    return {
      [COPY_STATUS.Idle]: idle,
      [COPY_STATUS.Pending]: idle,
      [COPY_STATUS.Copied]: { label: labels.copied, message: feedback.success.message },
      [COPY_STATUS.Failed]: feedback.failure,
      [COPY_STATUS.Unavailable]: feedback.unavailable,
    };
  }, [labels.copy, labels.copied, feedback]);
  const current = byStatus[status];

  return (
    <>
      <button ref={buttonRef} type="button" className={className} onClick={() => void copy(value)}>
        {current.label}
      </button>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        <span key={attempt}>{current.message}</span>
      </span>
    </>
  );
}
