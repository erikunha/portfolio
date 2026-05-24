import { nowRows } from '@/content/now';
import { IconNow } from '../../Icons';
import { Module } from '../../responsive/Module';
import styles from './NowSection.module.css';

export function NowSection() {
  return (
    <Module id="sec-now" header="CAT ~/.NOW" icon={<IconNow />}>
      <div className={styles.root}>
        {nowRows.map((r) => (
          <div key={r.k} className={styles.row}>
            <span className={styles.k}>{r.k}</span>
            <span className={styles.v}>{r.v}</span>
          </div>
        ))}
      </div>
    </Module>
  );
}
