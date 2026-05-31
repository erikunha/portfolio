import { cn } from '@/lib/cn';

export type StatTileProps = { value: string; label: string; variant?: 'default' | 'compact' };

export function StatTile({ value, label, variant = 'default' }: StatTileProps) {
  return (
    <dl className="flex flex-col py-[7px] px-[10px] m-0">
      <dt className="text-text-body text-[10px] tracking-[0.08em] opacity-65 font-mono leading-[1.3]">
        {label}
      </dt>
      <dd
        className={cn(
          'order-first text-signal text-xs md:text-sm font-bold tracking-[0.04em] font-mono leading-[1.3] m-0',
          variant === 'compact' && 'text-xs md:text-xs',
        )}
      >
        {value}
      </dd>
    </dl>
  );
}
