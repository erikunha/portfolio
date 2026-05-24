// components/responsive/MobileTitleBar.tsx
'use client';

import styles from './MobileTitleBar.module.css';

export function MobileTitleBar() {
  return (
    <div className={styles.root}>
      <div className={styles.dots} aria-hidden="true">
        <span className={`${styles.dot} ${styles.dotRed}`} />
        <span className={`${styles.dot} ${styles.dotYellow}`} />
        <span className={`${styles.dot} ${styles.dotGreen}`} />
      </div>
      <div className={styles.title} aria-hidden="true">
        ERIK_CUNHA.SH
      </div>
      <div aria-hidden="true" />
    </div>
  );
}
