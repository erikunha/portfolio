import { cn } from '@/lib/cn';

export type StatTileProps = { value: string; label: string; variant?: 'default' | 'compact' };

export function StatTile({ value, label, variant = 'default' }: StatTileProps) {
  return (
    <dl className="stat-tile flex flex-col py-[7px] px-[10px] m-0">
      <dt className="stat-tile-label text-tertiary-50 text-xs max-md:text-[10px] tracking-[0.08em] opacity-65 font-mono leading-[1.3]">
        {label}
      </dt>
      <dd
        className={cn(
          'stat-tile-value order-first text-primary-500 font-bold tracking-[0.04em] font-mono leading-none m-0',
          variant === 'compact' ? 'text-xs' : 'text-base max-md:text-xs',
        )}
      >
        {value}
      </dd>
    </dl>
  );
}
