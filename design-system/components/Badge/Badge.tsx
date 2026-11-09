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
  sm: 'text-xs py-[3px] px-2',
  md: 'text-xs py-1 px-[10px]',
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
        'badge inline-flex items-center gap-[7px] border border-primary-subtle bg-secondary-950 text-primary-500 font-mono tracking-[0.12em] whitespace-nowrap uppercase',
        'max-[359px]:whitespace-normal max-[359px]:flex-wrap',
        sizeClasses[size],
        className,
      )}
    >
      {variant === 'dot' && <span className="badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
