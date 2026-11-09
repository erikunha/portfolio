import { projectReceipts, receiptsHeading } from '@/content/perf-receipts';
import type { SiteLocale } from '@/content/site-locale';

const RECEIPTS_ANCHOR_ID = 'sec-perf-receipts';

export function PerfReceiptsSection({ locale }: { locale: SiteLocale }) {
  const receipts = projectReceipts(locale);
  const [featured] = receipts;
  return (
    <div className="project-receipts">
      <h3 id={RECEIPTS_ANCHOR_ID}>{receiptsHeading}</h3>
      <ul>
        {receipts.map((receipt) => (
          <li key={receipt.metric}>
            <span className="receipt-metric" data-receipt-metric>
              {receipt.metric}
            </span>
            <span
              className="receipt-value"
              data-delta
              data-featured={receipt === featured || undefined}
            >
              {receipt.displayValue ?? receipt.delta}
            </span>
            <span className="receipt-company">{receipt.company}</span>
            <span className="receipt-context">{receipt.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
