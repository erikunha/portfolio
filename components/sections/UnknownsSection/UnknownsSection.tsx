import { unknowns } from '@/content/unknowns';
import { IconUnknowns } from '../../Icons';
import { Module } from '../../responsive/Module';
import styles from './UnknownsSection.module.css';

export function UnknownsSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module id="sec-unknowns" header="CAT ~/.UNKNOWNS" icon={<IconUnknowns />} defer={defer}>
      <div className={styles.root}>
        <pre>
          <span className={styles.cmd}>
            <span className={styles.gt}>$</span>
            {' cat ~/.unknowns'}
          </span>
          {'\n\n'}
          <span className={styles.h}>{"# things i'm actively learning"}</span>
          {'\n\n'}
          {unknowns.learning.map((item) => (
            <span key={item.claim}>
              <span className={styles.bul}>{'-'}</span>
              {` ${item.claim}\n`}
              <span className={styles.mute}>{`  (${item.context})`}</span>
              {'\n\n'}
            </span>
          ))}
          <span className={styles.h}>{"# things i've chosen not to specialize in (yet)"}</span>
          {'\n\n'}
          {unknowns.notSpecializing.map((item) => (
            <span key={item.claim}>
              <span className={styles.bul}>{'-'}</span>
              {` ${item.claim}\n`}
              <span className={styles.mute}>{`  (${item.context})`}</span>
              {'\n\n'}
            </span>
          ))}
          <span className={styles.open}>{unknowns.footer}</span>
        </pre>
      </div>
    </Module>
  );
}
