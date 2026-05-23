import { cx } from '../../lib/cx';
import styles from './StatTile.module.css';

export type StatTileProps = { value: string; label: string; variant?: 'default' | 'compact' };

export function StatTile({ value, label, variant = 'default' }: StatTileProps) {
  return (
    <dl className={cx(styles.root, variant === 'compact' && styles.compact)}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
    </dl>
  );
}
