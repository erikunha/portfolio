import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant = 'default' | 'dot';
export type BadgeSize = 'sm' | 'md';
export type BadgeProps = Omit<ComponentPropsWithoutRef<'span'>, 'children'> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-xs py-tight px-2',
  md: 'text-xs py-1 px-inset',
};

export function Badge({
  variant = 'default',
  size = 'md',
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      {...rest}
      className={cn(
        'badge inline-flex items-center gap-chip border border-(color:--color-border-strong) bg-(color:--color-surface) text-(color:--color-accent) font-mono tracking-2xl whitespace-nowrap uppercase',
        '@max-xs:whitespace-normal @max-xs:flex-wrap',
        sizeClasses[size],
        className,
      )}
    >
      {variant === 'dot' && <span className="badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
