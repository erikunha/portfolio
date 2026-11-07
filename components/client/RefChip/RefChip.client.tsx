'use client';

import type { HTMLAttributes } from 'react';
import type { CopyFeedback, CopyFeedbackState } from '@/content/schemas';
import { ContactCopyButton } from '../ContactForm/ContactCopyButton.client';

export const REF_COPY_RESET_MS = 2000;

type RefFeedback = Record<CopyFeedbackState, CopyFeedback>;
type RefLabels = { readonly copy: string; readonly copied: string };

export function RefCopyButton({
  value,
  feedback,
  labels,
}: {
  value: string;
  feedback: RefFeedback;
  labels?: RefLabels | undefined;
}) {
  return (
    <ContactCopyButton
      value={value}
      feedback={feedback}
      labels={labels ?? { copy: feedback.idle.label, copied: feedback.success.label }}
      className="ref-copy"
      resetMs={REF_COPY_RESET_MS}
    />
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
