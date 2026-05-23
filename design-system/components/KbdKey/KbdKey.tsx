import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './KbdKey.module.css';

type KbdKeyProps = { size?: 'sm' | 'md'; children: ReactNode };

export function KbdKey({ size = 'md', children }: KbdKeyProps) {
  return <kbd className={cx(styles.root, styles[size])}>{children}</kbd>;
}
