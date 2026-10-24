'use client';
import { type ButtonHTMLAttributes, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

const COPY_FEEDBACK = {
  idle: { label: 'COPY', message: '' },
  success: { label: 'COPIED', message: 'Copied to clipboard.' },
  failure: { label: 'COPY FAILED', message: 'Copy failed. Select and copy the text manually.' },
  unavailable: {
    label: 'COPY UNAVAILABLE',
    message: 'Clipboard unavailable. Select and copy the text manually.',
  },
} as const;
const COPY_FEEDBACK_DURATION_MS = 1500;

type CopyFeedback = (typeof COPY_FEEDBACK)[keyof typeof COPY_FEEDBACK];
type CopyButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { text: string };

export function CopyButton({
  text,
  className,
  onClick,
  type = 'button',
  ...rest
}: CopyButtonProps) {
  const [feedback, setFeedback] = useState<CopyFeedback>(COPY_FEEDBACK.idle);
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

  async function copy() {
    if (copyingRef.current) return;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setAttempt((current) => current + 1);
    setFeedback(COPY_FEEDBACK.idle);
    copyingRef.current = true;
    try {
      if (typeof navigator.clipboard?.writeText !== 'function') {
        setFeedback(COPY_FEEDBACK.unavailable);
        return;
      }
      await navigator.clipboard.writeText(text);
      if (!mountedRef.current) return;
      setFeedback(COPY_FEEDBACK.success);
      timerRef.current = setTimeout(
        () => setFeedback(COPY_FEEDBACK.idle),
        COPY_FEEDBACK_DURATION_MS,
      );
    } catch {
      if (mountedRef.current) setFeedback(COPY_FEEDBACK.failure);
    } finally {
      copyingRef.current = false;
    }
  }

  return (
    <>
      <button
        {...rest}
        type={type}
        className={cn('copy-btn', className)}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) void copy();
        }}
      >
        {feedback.label}
      </button>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        <span key={attempt}>{feedback.message}</span>
      </span>
    </>
  );
}
