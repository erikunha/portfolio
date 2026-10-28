import { projectReceipts, receiptsHeading } from '@/content/perf-receipts';

export function PerfReceiptsSection() {
  const [featured] = projectReceipts;
  return (
    <div id="sec-perf-receipts" className="project-receipts">
      <h3>{receiptsHeading}</h3>
      <ul>
        {projectReceipts.map((receipt) => (
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
