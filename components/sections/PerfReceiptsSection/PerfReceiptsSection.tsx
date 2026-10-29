import { projectReceipts, receiptsHeading } from '@/content/perf-receipts';

const HEADING_ID = 'perf-receipts-heading';

export function PerfReceiptsSection() {
  const [featured] = projectReceipts;
  return (
    // biome-ignore lint/a11y/useSemanticElements: ProjectsSection.test.tsx asserts exactly one <section> in the Projects subtree, so the receipts block is a named region on a div
    <div
      role="region"
      id="sec-perf-receipts"
      className="project-receipts"
      tabIndex={-1}
      aria-labelledby={HEADING_ID}
    >
      <h3 id={HEADING_ID}>{receiptsHeading}</h3>
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
