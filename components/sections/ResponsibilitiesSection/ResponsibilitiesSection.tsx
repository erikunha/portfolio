import { responsibilities } from '@/content/responsibilities';
import { IconResponsibilities } from '../../Icons';
import { Module } from '../../responsive/Module';
import styles from './ResponsibilitiesSection.module.css';

export function ResponsibilitiesSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-responsibilities"
      header="LS -LA ~/RESPONSIBILITIES"
      icon={<IconResponsibilities />}
      defer={defer}
    >
      <div className={styles.root}>
        <div className={styles.cmd}>
          <span className={styles.gt}>$</span>
          {'ls -la ~/responsibilities  '}
          <span style={{ color: 'var(--ds-color-text-faint)' }}>
            {'// role boundaries, in unix terms'}
          </span>
        </div>
        <pre>
          {responsibilities.map((r) => (
            <span key={r.name}>
              <span className={styles.perm}>{r.perms}</span>
              {'  '}
              <span className={styles.user}>{r.user}</span>
              {'  '}
              <span className={styles.group}>{r.group}</span>
              {'  '}
              <span className={styles.file} data-highlight={r.highlight || undefined}>
                {r.name}
              </span>
              {'\n'}
            </span>
          ))}
        </pre>
        <div className={styles.foot}>
          <span>
            <span className={styles.k}>drwxr-xr-x</span>
            {'  i own it, you can read it, you can run against it'}
          </span>
          <span>
            <span className={styles.k}>drwxrwxrwx</span>
            {'  explicitly shared — please write here too'}
          </span>
          <span>
            <span className={styles.k}>drwxr-x---</span>
            {'  owned, run only by trusted group (security, compliance)'}
          </span>
          <span>
            <span className={styles.k}>-rwx------</span>
            {'  not delegable; this is the one i bring to the room'}
          </span>
        </div>
      </div>
    </Module>
  );
}
