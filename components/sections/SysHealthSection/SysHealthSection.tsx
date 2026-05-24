import { sysStats } from '@/content/sys-health';
import { IconSysHealth } from '../../Icons';
import { Module } from '../../responsive/Module';
import styles from './SysHealthSection.module.css';

export function SysHealthSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module id="sec-sys-health" header="SYS_HEALTH_MONITOR" icon={<IconSysHealth />} defer={defer}>
      <div className={styles.root}>
        {sysStats.map((s) => (
          <div key={s.label} className={styles.stat}>
            <div className={styles.label}>{s.label}</div>
            <div className={styles.value}>{s.value}</div>
            <div className={`${styles.bar} ${styles.pulse}`}>
              <i style={{ width: s.pct }} />
            </div>
          </div>
        ))}
      </div>
    </Module>
  );
}
