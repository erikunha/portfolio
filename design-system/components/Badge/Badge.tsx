import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant = 'default' | 'dot';
export type BadgeSize = 'sm' | 'md';
export type BadgeProps = { variant?: BadgeVariant; size?: BadgeSize; children: ReactNode };

export function Badge({ variant = 'default', size = 'md', children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[7px] border border-signal-subtle text-signal font-mono tracking-[0.12em] py-1 px-[10px] whitespace-nowrap uppercase',
        // At very narrow viewports (<360px) allow wrapping so it stays within bounds.
        // Tailwind has no built-in 360px breakpoint; use inline style via a CSS class.
        'max-[359px]:whitespace-normal max-[359px]:flex-wrap',
        size === 'sm' && 'text-[10px] py-[3px] px-2',
        size === 'md' && 'text-[10px]',
      )}
    >
      {variant === 'dot' && <span className="badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
