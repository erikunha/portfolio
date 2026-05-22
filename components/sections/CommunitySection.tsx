import { communityEvent } from '@/content/community';
import { IconCommunity } from '../Icons';
import { Module } from '../responsive/Module';
import styles from './CommunitySection.module.css';

export function CommunitySection({ defer }: { defer?: boolean } = {}) {
  const e = communityEvent;
  return (
    <Module id="sec-community" header="CAT ~/.COMMUNITY" icon={<IconCommunity />} defer={defer}>
      <div className={styles.root}>
        <div className={styles.title}>
          {e.name} · {e.year} · {e.role}
        </div>
        <ul>
          {e.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <div className={styles.status}>
          <span className={styles.gt}>{'>'}</span>status: {e.statusLine}
        </div>
      </div>
    </Module>
  );
}
