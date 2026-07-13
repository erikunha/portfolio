import { perfReceipts } from '@/content/perf-receipts';
import type { PerfReceipt } from '@/content/schemas';
import { SECTION_LABELS } from '@/content/section-labels';
import { cn } from '@/lib/cn';
import { IconPerfReceipts } from '../../Icons';
import { Module } from '../../responsive/Module';

function ReceiptCard({
  metric,
  delta,
  company,
  note,
  hero,
  desktopOnly,
  mobileMetric,
}: PerfReceipt & { hero?: boolean }) {
  return (
    <li
      className={cn(
        'receipt-card relative border border-primary-subtle',
        'flex flex-col gap-[4px] md:gap-[6px]',
        'min-h-0 md:min-h-[170px]',
        'p-3 md:p-[18px_16px_16px]',
        hero &&
          'receipt-hero-gradient border-primary-500 col-span-2 row-span-2 md:row-span-2 p-3 md:p-[24px_22px_22px]',
        desktopOnly && 'hidden md:flex',
      )}
    >
      <p className="text-primary-400 text-xs tracking-[0.18em] m-0">
        {mobileMetric ? (
          <>
            <span className="hidden md:inline">{metric}</span>
            <span className="inline md:hidden">{mobileMetric}</span>
          </>
        ) : (
          metric
        )}
      </p>
      <p
        className={cn(
          'text-primary-500 font-mono font-bold leading-none tracking-[-0.01em] m-[4px_0_8px] md:m-[6px_0_8px]',
          hero ? 'text-[32px] md:text-[64px]' : 'text-[24px] md:text-[32px]',
        )}
        data-featured={hero || undefined}
        data-delta
      >
        {delta}
      </p>
      <p className="text-primary-400 text-xs tracking-[0.14em] m-0">{company}</p>
      <p
        className={cn(
          'text-tertiary-50 leading-[1.5] mt-auto pt-[6px]',
          'border-t border-dashed border-[var(--color-primary-quiet)]',
          'text-xs md:text-xs',
          hero && 'md:pt-[10px]',
        )}
      >
        {note}
      </p>
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
      srLabel={SECTION_LABELS['sec-perf-receipts']}
      icon={<IconPerfReceipts />}
      defer={defer}
    >
      <ul className="perf-receipts-grid list-none m-0 p-0 grid grid-cols-2 min-[901px]:grid-cols-4 gap-2 md:gap-[14px]">
        <ReceiptCard {...hero} hero />
        {rest.map((r) => (
          <ReceiptCard key={r.metric} {...r} />
        ))}
      </ul>
    </Module>
  );
}
