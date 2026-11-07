import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type StatTileProps = HTMLAttributes<HTMLDListElement> & {
  value: string;
  label: string;
  variant?: 'default' | 'compact' | 'display';
};

const variantClasses: Record<NonNullable<StatTileProps['variant']>, string> = {
  compact: 'text-xs',
  default: 'text-base max-md:text-xs',
  display: 'text-2xl max-md:text-base',
};

export function StatTile({ value, label, variant = 'default', className, ...rest }: StatTileProps) {
  return (
    <dl {...rest} className={cn('stat-tile flex flex-col py-[7px] px-[10px] m-0', className)}>
      <dt className="stat-tile-label text-text-secondary text-xs tracking-[0.08em] font-mono leading-[1.3]">
        {label}
      </dt>
      <dd
        className={cn(
          'stat-tile-value order-first text-primary-500 font-bold tracking-[0.04em] font-mono leading-none m-0',
          variantClasses[variant],
        )}
      >
        {value}
      </dd>
    </dl>
  );
}
