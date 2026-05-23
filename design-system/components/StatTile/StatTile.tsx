import { cx } from '../../lib/cx';
import styles from './StatTile.module.css';

type StatTileProps = { value: string; label: string; variant?: 'default' | 'compact' };

export function StatTile({ value, label, variant = 'default' }: StatTileProps) {
  return (
    <dl className={cx(styles.root, styles[variant])}>
      <dd className={styles.value}>{value}</dd>
      <dt className={styles.label}>{label}</dt>
    </dl>
  );
}
