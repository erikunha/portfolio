import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/cn';

export type WindowChromeProps = ComponentPropsWithoutRef<'div'> & {
  size?: number;
};

export function WindowChrome({ size = 10, className, style, ...rest }: WindowChromeProps) {
  return (
    <div
      className={cn('window-chrome flex gap-[6px] items-center', className)}
      style={{ '--wc-dot-size': `${size}px`, ...style } as React.CSSProperties}
      {...rest}
    >
      <span
        aria-hidden="true"
        className="block flex-shrink-0 rounded-full bg-senary-500"
        style={{ width: 'var(--wc-dot-size)', height: 'var(--wc-dot-size)' }}
        data-dot="red"
      />
      <span
        aria-hidden="true"
        className="block flex-shrink-0 rounded-full bg-quinary-500"
        style={{ width: 'var(--wc-dot-size)', height: 'var(--wc-dot-size)' }}
        data-dot="yellow"
      />
      <span
        aria-hidden="true"
        className="block flex-shrink-0 rounded-full bg-primary-600"
        style={{ width: 'var(--wc-dot-size)', height: 'var(--wc-dot-size)' }}
        data-dot="green"
      />
    </div>
  );
}
