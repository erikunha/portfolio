import { ExternalLink } from '@/components/ExternalLink';
import type { ContactContent } from '@/content/contact';
import { ContactReceipt } from './ContactReceipt';
import { CONTACT_STATUS } from './useContactSubmit';

const focusResult = (node: HTMLDivElement | null) => node?.focus();

export function ContactResult({
  copy,
  status,
  receipt,
  onDismiss,
}: {
  copy: ContactContent;
  status: typeof CONTACT_STATUS.SUCCESS | typeof CONTACT_STATUS.QUEUED;
  receipt: { at: Date } | null;
  onDismiss: () => void;
}) {
  const dismissButton = (
    <button
      type="button"
      className="copy-btn contact-dismiss"
      aria-label={copy.dismiss.aria}
      onClick={onDismiss}
    >
      {copy.dismiss.label}
    </button>
  );

  if (status === CONTACT_STATUS.SUCCESS) {
    return (
      <div
        className="contact-success"
        role="status"
        data-testid="contact-success"
        tabIndex={-1}
        ref={focusResult}
      >
        <p className="contact-state-title">{copy.success.title}</p>
        <div className="contact-action-row">
          <p>{copy.success.message}</p>
          {dismissButton}
        </div>
        {receipt ? <ContactReceipt copy={copy} receipt={receipt} /> : null}
      </div>
    );
  }
  return (
    <div
      className="contact-success contact-queued"
      role="status"
      data-testid="contact-queued"
      tabIndex={-1}
      ref={focusResult}
    >
      <p className="contact-state-title">{copy.queued.title}</p>
      <p>{copy.queued.message}</p>
      <div className="contact-action-row">
        <p>
          {copy.queued.fasterLabel}{' '}
          <ExternalLink href={copy.queued.linkHref}>
            {copy.queued.linkLabel} {copy.queued.linkGlyph}
          </ExternalLink>
        </p>
        {dismissButton}
      </div>
    </div>
  );
}
