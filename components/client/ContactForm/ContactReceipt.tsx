import { useEffect, useRef, useState } from 'react';
import type { ContactContent } from '@/content/contact';
import { forgetRequest, wasForgotten } from '@/lib/forget-request.client';
import { RefChip } from '../RefChip/RefChip.client';

const FORGET = { IDLE: 'idle', PENDING: 'pending', DONE: 'done', FAILED: 'failed' } as const;
type ForgetState = (typeof FORGET)[keyof typeof FORGET];
const RECEIPT_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'short',
};

export function ContactReceipt({
  copy,
  receipt,
}: {
  copy: ContactContent;
  receipt: { ref: string; at: Date };
}) {
  const text = copy.success.receipt;
  const [forget, setForget] = useState<ForgetState>(FORGET.IDLE);
  const forgetPending = useRef(false);
  const forgetButton = useRef<HTMLButtonElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const at = new Intl.DateTimeFormat(text.dateLocale, RECEIPT_TIME_FORMAT)
    .format(receipt.at)
    .replace(',', '');
  const subject = encodeURIComponent(`${text.forgetSubject} ${receipt.ref}`);

  async function forgetMessage() {
    if (forgetPending.current) return;
    forgetPending.current = true;
    setForget(FORGET.PENDING);
    try {
      const result = await forgetRequest(receipt.ref);
      restoreFocus.current =
        wasForgotten(result) && document.activeElement === forgetButton.current;
      setForget(wasForgotten(result) ? FORGET.DONE : FORGET.FAILED);
    } finally {
      forgetPending.current = false;
    }
  }

  useEffect(() => {
    if (forget === FORGET.DONE && restoreFocus.current) copyButton.current?.focus();
  }, [forget]);

  return (
    <div className="contact-receipt" data-testid="contact-receipt">
      <RefChip
        buttonRef={copyButton}
        value={receipt.ref}
        prefix={text.refLabel}
        labels={{ copy: text.copy, copied: text.copied }}
        feedback={text.feedback}
      />
      <dl>
        <dt>{text.atLabel}</dt>
        <dd>
          <time dateTime={receipt.at.toISOString()}>{at}</time>
        </dd>
      </dl>
      <div className="contact-receipt-actions">
        {forget !== FORGET.DONE && (
          <button
            ref={forgetButton}
            type="button"
            className="copy-btn contact-copy-btn"
            aria-disabled={forget === FORGET.PENDING}
            onClick={() => void forgetMessage()}
          >
            {forget === FORGET.PENDING ? text.forget.pending : text.forget.label}
          </button>
        )}
      </div>
      <p className="contact-forget-status" role="status" data-testid="contact-forget-status">
        {forget === FORGET.DONE && text.forget.done}
        {forget === FORGET.FAILED && (
          <>
            {text.forget.failed}{' '}
            <a href={`mailto:${copy.section.email}?subject=${subject}`}>{copy.section.email}</a>
          </>
        )}
      </p>
    </div>
  );
}
