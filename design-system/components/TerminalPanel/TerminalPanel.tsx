import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BorderStyle = 'solid' | 'dashed';
export type AsElement = 'div' | 'section' | 'article';

export type TerminalPanelProps = ComponentPropsWithoutRef<'div'> & {
  borderStyle?: BorderStyle;
  as?: AsElement;
  header?: ReactNode;
};

export function TerminalPanel({
  borderStyle = 'solid',
  as = 'div',
  header,
  children,
  className,
  ...rest
}: TerminalPanelProps) {
  const Element = as;
  return (
    <Element
      className={cn(
        'terminal-panel border border-primary-subtle bg-transparent',
        borderStyle === 'dashed' && 'border-dashed',
        className,
      )}
      {...rest}
    >
      {header != null && (
        <div className="border-b border-primary-subtle py-[6px] px-[14px] md:px-[18px] lg:px-6 text-xs tracking-[0.12em] text-primary-500 font-mono">
          {header}
        </div>
      )}
      {children}
    </Element>
  );
}
