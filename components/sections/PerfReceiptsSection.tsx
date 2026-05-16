import { perfReceipts } from '@/content/perf-receipts';
import type { PerfReceipt } from '@/content/schemas';
import { IconPerfReceipts } from '../Icons';
import { Module } from '../responsive/Module';

function ReceiptCard({
  metric,
  delta,
  company,
  note,
  hero,
  desktopOnly,
  mobileMetric,
}: PerfReceipt & { hero?: boolean }) {
  const cls = [
    hero ? 'receipt receipt--hero' : 'receipt',
    desktopOnly ? 'receipt--desktop-only' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li className={cls}>
      <p className="receipt__metric">
        {mobileMetric ? (
          <>
            <span className="receipt__metric-desktop">{metric}</span>
            <span className="receipt__metric-mobile">{mobileMetric}</span>
          </>
        ) : (
          metric
        )}
      </p>
      <p className={hero ? 'receipt__delta receipt__delta--hero' : 'receipt__delta'}>{delta}</p>
      <p className="receipt__company">{company}</p>
      <p className="receipt__note">{note}</p>
    </li>
  );
}

export function PerfReceiptsSection() {
  const [hero, ...rest] = perfReceipts;
  if (!hero) return null;
  return (
    <Module
      id="sec-perf-receipts"
      header="PERF_RECEIPTS --HARD-NUMBERS"
      mobileHeader="PERF_RECEIPTS"
      icon={<IconPerfReceipts />}
    >
      <ul className="receipts">
        <ReceiptCard {...hero} hero />
        {rest.map((r) => (
          <ReceiptCard key={r.metric} {...r} />
        ))}
      </ul>
    </Module>
  );
}
