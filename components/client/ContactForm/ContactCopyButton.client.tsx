'use client';

import { useMemo } from 'react';
import type { CopyFeedback } from '@/content/schemas';
import { COPY_STATUS, type CopyStatus, useCopyFeedback } from '@/lib/use-copy-feedback.client';

export function ContactCopyButton({
  value,
  labels,
  feedback,
}: {
  value: string;
  labels: { readonly copy: string; readonly copied: string };
  feedback: {
    readonly idle: CopyFeedback;
    readonly success: CopyFeedback;
    readonly failure: CopyFeedback;
    readonly unavailable: CopyFeedback;
  };
}) {
  const { status, attempt, copy } = useCopyFeedback();
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
      <button type="button" className="copy-btn contact-copy-btn" onClick={() => void copy(value)}>
        {current.label}
      </button>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        <span key={attempt}>{current.message}</span>
      </span>
    </>
  );
}
