import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BorderStyle = 'solid' | 'dashed';
export type AsElement = 'div' | 'section' | 'article';

// Narrowing to div attrs is safe: div|section|article share the same HTML attribute set.
// Consumers that need element-specific aria attributes can cast or use wrapper pattern.
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
        'border border-signal-subtle bg-transparent',
        borderStyle === 'dashed' && 'border-dashed',
        className,
      )}
      {...rest}
    >
      {header != null && (
        <div className="border-b border-signal-subtle py-[6px] px-[var(--ds-space-pad)] text-[10px] tracking-[0.12em] text-signal font-mono">
          {header}
        </div>
      )}
      {children}
    </Element>
  );
}
