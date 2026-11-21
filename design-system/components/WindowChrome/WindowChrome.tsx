import type { ComponentPropsWithoutRef } from 'react';
import { joinClassNames } from '@/lib/join-class-names';

export type WindowChromeProps = ComponentPropsWithoutRef<'div'> & {
  size?: number;
};

type WindowChromeDot = {
  key: 'red' | 'yellow' | 'green';
  colorClass: string;
};

const WINDOW_CHROME_DOTS: readonly WindowChromeDot[] = [
  { key: 'red', colorClass: 'bg-(color:--color-danger)' },
  { key: 'yellow', colorClass: 'bg-(color:--color-warning)' },
  { key: 'green', colorClass: 'bg-signal-600' },
];

const DOT_BASE_CLASS = 'block flex-shrink-0 rounded-full';

const DOT_STYLE = { width: 'var(--wc-dot-size)', height: 'var(--wc-dot-size)' };

export function WindowChrome({ size = 10, className, style, ...rest }: WindowChromeProps) {
  return (
    <div
      className={joinClassNames('window-chrome flex gap-pip items-center', className)}
      style={{ '--wc-dot-size': `${size}px`, ...style } as React.CSSProperties}
      {...rest}
    >
      {WINDOW_CHROME_DOTS.map((dot) => (
        <span
          key={dot.key}
          aria-hidden="true"
          className={`${DOT_BASE_CLASS} ${dot.colorClass}`}
          style={DOT_STYLE}
          data-dot={dot.key}
        />
      ))}
    </div>
  );
}
