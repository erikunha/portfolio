import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Badge.module.css';

export type BadgeVariant = 'default' | 'dot';
export type BadgeSize = 'sm' | 'md';
export type BadgeProps = { variant?: BadgeVariant; size?: BadgeSize; children: ReactNode };

export function Badge({ variant = 'default', size = 'md', children }: BadgeProps) {
  return (
    <span className={cx(styles.root, styles[variant], styles[size])}>
      {variant === 'dot' && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}
