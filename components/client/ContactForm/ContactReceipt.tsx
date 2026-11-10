import type { ContactContent } from '@/content/contact';

const RECEIPT_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'short',
};

export function ContactReceipt({ copy, receipt }: { copy: ContactContent; receipt: { at: Date } }) {
  const text = copy.success.receipt;
  const at = new Intl.DateTimeFormat(text.dateLocale, RECEIPT_TIME_FORMAT)
    .format(receipt.at)
    .replace(',', '');

  return (
    <div className="contact-receipt" data-testid="contact-receipt">
      <dl>
        <dt>{text.atLabel}</dt>
        <dd>
          <time dateTime={receipt.at.toISOString()}>{at}</time>
        </dd>
      </dl>
    </div>
  );
}
