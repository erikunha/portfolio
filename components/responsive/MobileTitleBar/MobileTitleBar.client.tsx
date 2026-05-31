// components/responsive/MobileTitleBar/MobileTitleBar.client.tsx
'use client';

import { WindowChrome } from '@/design-system';
import styles from './MobileTitleBar.module.css';

export function MobileTitleBar() {
  return (
    <div className={styles.root}>
      <WindowChrome size={9} />
      <div className={styles.title} aria-hidden="true">
        ERIK_CUNHA.SH
      </div>
      <div aria-hidden="true" />
    </div>
  );
}
