'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { contactCopy } from '@/content/contact-copy';
import { copyFeedback as COPY_FEEDBACK } from '@/content/copy-button';
import type { CopyFeedback } from '@/content/schemas';

const COPY_FEEDBACK_DURATION_MS = 1500;

const CONTACT_COPY_IDLE: CopyFeedback = {
  label: contactCopy.section.copyEmail,
  message: '',
};

const CONTACT_COPY_SUCCESS: CopyFeedback = {
  label: contactCopy.section.copyEmailCopied,
  message: COPY_FEEDBACK.success.message,
};

export function ContactCopyButton({ email }: { email: string }) {
  const [feedback, setFeedback] = useState<CopyFeedback>(CONTACT_COPY_IDLE);
  const [attempt, setAttempt] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback(async () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setAttempt((current) => current + 1);
    setFeedback(CONTACT_COPY_IDLE);
    try {
      if (typeof navigator.clipboard?.writeText !== 'function') {
        setFeedback(COPY_FEEDBACK.unavailable);
        return;
      }
      await navigator.clipboard.writeText(email);
      if (!mountedRef.current) return;
      setFeedback(CONTACT_COPY_SUCCESS);
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) setFeedback(CONTACT_COPY_IDLE);
      }, COPY_FEEDBACK_DURATION_MS);
    } catch {
      if (mountedRef.current) setFeedback(COPY_FEEDBACK.failure);
    }
  }, [email]);

  return (
    <>
      <button type="button" className="copy-btn contact-copy-btn" onClick={() => void copy()}>
        {feedback.label}
      </button>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        <span key={attempt}>{feedback.message}</span>
      </span>
    </>
  );
}
