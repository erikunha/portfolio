'use client';
import type { ButtonHTMLAttributes } from 'react';
import { copyFeedback } from '@/content/copy-button';
import type { CopyFeedback } from '@/content/schemas';
import { SITE_LOCALE } from '@/content/site-locale';
import { cn } from '@/lib/cn';
import { COPY_STATUS, type CopyStatus, useCopyFeedback } from '@/lib/use-copy-feedback.client';

const COPY_FEEDBACK = copyFeedback[SITE_LOCALE.en];
const FEEDBACK_BY_STATUS: Record<CopyStatus, CopyFeedback> = {
  [COPY_STATUS.Idle]: COPY_FEEDBACK.idle,
  [COPY_STATUS.Pending]: COPY_FEEDBACK.idle,
  [COPY_STATUS.Copied]: COPY_FEEDBACK.success,
  [COPY_STATUS.Failed]: COPY_FEEDBACK.failure,
  [COPY_STATUS.Unavailable]: COPY_FEEDBACK.unavailable,
};

type CopyButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { text: string };

export function CopyButton({
  text,
  className,
  onClick,
  type = 'button',
  ...rest
}: CopyButtonProps) {
  const { status, attempt, copy } = useCopyFeedback();
  const feedback = FEEDBACK_BY_STATUS[status];

  return (
    <>
      <button
        {...rest}
        type={type}
        className={cn('copy-btn', className)}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) void copy(text);
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
