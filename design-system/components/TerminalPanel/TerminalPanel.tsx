import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './TerminalPanel.module.css';

export type BorderStyle = 'solid' | 'dashed';
export type AsElement = 'div' | 'section' | 'article';
export type TerminalPanelProps = {
  borderStyle?: BorderStyle;
  as?: AsElement;
  header?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function TerminalPanel({
  borderStyle = 'solid',
  as: Element = 'div',
  header,
  children,
  className,
}: TerminalPanelProps) {
  return (
    <Element className={cx(styles.root, borderStyle === 'dashed' && styles.dashed, className)}>
      {header && <div className={styles.header}>{header}</div>}
      {children}
    </Element>
  );
}
