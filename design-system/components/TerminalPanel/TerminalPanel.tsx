import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './TerminalPanel.module.css';

type BorderStyle = 'solid' | 'dashed';
type AsElement = 'div' | 'section' | 'article';
type TerminalPanelProps = {
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
    <Element className={cx(styles.root, styles[borderStyle], className)}>
      {header && <div className={styles.header}>{header}</div>}
      {children}
    </Element>
  );
}
