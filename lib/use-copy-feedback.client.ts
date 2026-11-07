'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export const COPY_FEEDBACK_RESET_MS = 1500;

export const COPY_STATUS = {
  Idle: 'idle',
  Pending: 'pending',
  Copied: 'copied',
  Failed: 'failed',
  Unavailable: 'unavailable',
} as const;

export type CopyStatus = (typeof COPY_STATUS)[keyof typeof COPY_STATUS];

type CopyFeedbackOptions = {
  resetMs?: number | null;
  resetOnFailure?: boolean;
};

export function useCopyFeedback({
  resetMs = COPY_FEEDBACK_RESET_MS,
  resetOnFailure = false,
}: CopyFeedbackOptions = {}) {
  const [status, setStatus] = useState<CopyStatus>(COPY_STATUS.Idle);
  const [attempt, setAttempt] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string): Promise<CopyStatus> => {
      if (copyingRef.current) return COPY_STATUS.Pending;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      copyingRef.current = true;
      setAttempt((current) => current + 1);
      setStatus(COPY_STATUS.Pending);
      let outcome: CopyStatus;
      try {
        if (typeof navigator.clipboard?.writeText !== 'function') {
          outcome = COPY_STATUS.Unavailable;
        } else {
          await navigator.clipboard.writeText(text);
          outcome = COPY_STATUS.Copied;
        }
      } catch {
        outcome = COPY_STATUS.Failed;
      } finally {
        copyingRef.current = false;
      }
      if (!mountedRef.current) return outcome;
      setStatus(outcome);
      if (resetMs !== null && (outcome === COPY_STATUS.Copied || resetOnFailure)) {
        timerRef.current = setTimeout(() => setStatus(COPY_STATUS.Idle), resetMs);
      }
      return outcome;
    },
    [resetMs, resetOnFailure],
  );

  return { status, attempt, copy };
}
