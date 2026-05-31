import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './TerminalPanel.module.css';

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
      className={cx(styles.root, borderStyle === 'dashed' && styles.dashed, className)}
      {...rest}
    >
      {header != null && <div className={styles.header}>{header}</div>}
      {children}
    </Element>
  );
}
