'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContactContent } from '@/content/contact';
import type { CopyFeedback } from '@/content/schemas';

const COPY_FEEDBACK_DURATION_MS = 1500;

export function ContactCopyButton({
  email,
  copy,
  feedback,
}: {
  email: string;
  copy: ContactContent;
  feedback: {
    readonly idle: CopyFeedback;
    readonly success: CopyFeedback;
    readonly failure: CopyFeedback;
    readonly unavailable: CopyFeedback;
  };
}) {
  const [state, setState] = useState<CopyFeedback>({
    label: copy.section.copyEmail,
    message: '',
  });
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

  const runCopy = useCallback(async () => {
    const idle: CopyFeedback = { label: copy.section.copyEmail, message: '' };
    const success: CopyFeedback = {
      label: copy.section.copyEmailCopied,
      message: feedback.success.message,
    };
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setAttempt((current) => current + 1);
    setState(idle);
    try {
      if (typeof navigator.clipboard?.writeText !== 'function') {
        setState(feedback.unavailable);
        return;
      }
      await navigator.clipboard.writeText(email);
      if (!mountedRef.current) return;
      setState(success);
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) setState(idle);
      }, COPY_FEEDBACK_DURATION_MS);
    } catch {
      if (mountedRef.current) setState(feedback.failure);
    }
  }, [email, copy.section.copyEmail, copy.section.copyEmailCopied, feedback]);

  return (
    <>
      <button type="button" className="copy-btn contact-copy-btn" onClick={() => void runCopy()}>
        {state.label}
      </button>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        <span key={attempt}>{state.message}</span>
      </span>
    </>
  );
}
