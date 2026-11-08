import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type KbdKeyProps = Omit<ComponentPropsWithoutRef<'kbd'>, 'children'> & {
  size?: 'sm' | 'md';
  children: ReactNode;
};

export function KbdKey({ size = 'md', className, children, ...rest }: KbdKeyProps) {
  return (
    <kbd
      {...rest}
      className={cn(
        'kbd-key inline-flex items-center border border-primary-border text-tertiary-50 font-mono rounded-[2px]',
        size === 'sm' && 'text-xs px-1 py-0',
        size === 'md' && 'text-xs px-[6px] py-px',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
