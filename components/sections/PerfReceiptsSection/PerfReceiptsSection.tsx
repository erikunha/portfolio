import { perfReceiptsHeading, projectPerfReceipts } from '@/content/perf-receipts';
import { projectAnchor } from '@/content/projects';

export function PerfReceiptsSection({
  attached = false,
  defer = false,
}: {
  attached?: boolean;
  defer?: boolean;
} = {}) {
  const Heading = attached ? 'h3' : 'h2';
  const [featuredReceipt] = projectPerfReceipts;
  return (
    <section
      id="sec-perf-receipts"
      aria-labelledby="project-receipts-heading"
      className={`project-receipts${defer ? ' module-deferred' : ''}`}
      tabIndex={-1}
    >
      <Heading id="project-receipts-heading" className="project-receipts-heading">
        {perfReceiptsHeading}
      </Heading>
      <ul className="project-receipts-list">
        {projectPerfReceipts.map((receipt) => (
          <li
            key={receipt.metric}
            data-receipt={receipt.metric}
            className={`project-receipt${receipt === featuredReceipt ? ' project-receipt-featured' : ''}`}
          >
            <span className="project-receipt-metric">{receipt.metric}</span>
            <span
              className="project-receipt-value"
              data-delta
              data-featured={receipt === featuredReceipt || undefined}
            >
              {receipt.display}
              {receipt.display !== receipt.delta && (
                <span className="sr-only"> ({receipt.delta})</span>
              )}
            </span>
            {receipt.projectId ? (
              <a className="project-receipt-company" href={`#${projectAnchor(receipt.projectId)}`}>
                {receipt.company}
              </a>
            ) : (
              <span className="project-receipt-company">{receipt.company}</span>
            )}
            <span className="project-receipt-note">{receipt.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
