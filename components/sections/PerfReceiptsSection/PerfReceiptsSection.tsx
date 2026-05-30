import { perfReceipts } from '@/content/perf-receipts';
import type { PerfReceipt } from '@/content/schemas';
import { IconPerfReceipts } from '../../Icons';
import { Module } from '../../responsive/Module';
import styles from './PerfReceiptsSection.module.css';

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
    styles.receipt,
    hero ? styles.receiptHero : '',
    desktopOnly ? styles.receiptDesktopOnly : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li className={cls}>
      <p className={styles.metric}>
        {mobileMetric ? (
          <>
            <span className={styles.metricDesktop}>{metric}</span>
            <span className={styles.metricMobile}>{mobileMetric}</span>
          </>
        ) : (
          metric
        )}
      </p>
      <p className={styles.delta} data-featured={hero || undefined}>
        {delta}
      </p>
      <p className={styles.company}>{company}</p>
      <p className={styles.note}>{note}</p>
    </li>
  );
}

export function PerfReceiptsSection({ defer }: { defer?: boolean } = {}) {
  const [hero, ...rest] = perfReceipts;
  if (!hero) return null;
  return (
    <Module
      id="sec-perf-receipts"
      header="PERF_RECEIPTS --HARD-NUMBERS"
      variant="green"
      mobileHeader="PERF_RECEIPTS"
      icon={<IconPerfReceipts />}
      defer={defer}
    >
      <ul className={styles.root}>
        <ReceiptCard {...hero} hero />
        {rest.map((r) => (
          <ReceiptCard key={r.metric} {...r} />
        ))}
      </ul>
    </Module>
  );
}
