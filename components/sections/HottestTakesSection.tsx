import { hottestTakes, hottestTakesConfig } from '@/content/hottest-takes';
import { IconHottestTakes } from '../Icons';
import { Module } from '../responsive/Module';
import styles from './HottestTakesSection.module.css';

export function HottestTakesSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-hottest-takes"
      header="CAT ~/HOTTEST_TAKES.MD"
      icon={<IconHottestTakes />}
      defer={defer}
    >
      <div className={styles.preamble}>
        <span className={styles.gt}>$</span>
        {'cat ~/hottest_takes.md  '}
        <span style={{ color: 'var(--muted-dim)' }}>{hottestTakesConfig.preamble}</span>
      </div>
      <ol className={styles.root} start={1} data-testid="hottest-takes-list">
        {hottestTakes.map((t) => (
          <li key={t.num} className={styles.take}>
            <span className={styles.num}>{t.num}</span>
            <div className={styles.content}>
              <p className={styles.thesis}>
                <span className={styles.category}>{t.category}</span>
                {t.thesis}
              </p>
              <p className={styles.body}>{t.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className={styles.footer}>
        <span className={styles.gt}>{'>'}</span>
        {hottestTakesConfig.footer}
      </div>
    </Module>
  );
}
