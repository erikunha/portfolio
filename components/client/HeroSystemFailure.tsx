'use client';

import { useEffect, useState } from 'react';
import styles from '../sections/Hero/Hero.module.css';

// The SYSTEM FAILURE headline overlay, extracted from Hero.tsx DesktopHero.
// Listens for 'hero:sysfail:show' and 'hero:sysfail:hide' window events
// dispatched by HeroBootAnimation when the first dialog loop completes.
// The existing 'sysfail:start' / 'sysfail:end' events continue to handle
// MatrixRain pause/resume (unchanged from original wiring).
//
// State-based visibility replaces the prior classList.add/remove('on') approach:
// CSS Modules scopes class names to hashes, so direct DOM classList mutation
// would inject the un-scoped string 'on' which the module CSS never matches.
export function HeroSystemFailure() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onShow = () => setVisible(true);
    const onHide = () => setVisible(false);

    window.addEventListener('hero:sysfail:show', onShow);
    window.addEventListener('hero:sysfail:hide', onHide);
    return () => {
      window.removeEventListener('hero:sysfail:show', onShow);
      window.removeEventListener('hero:sysfail:hide', onHide);
    };
  }, []);

  return (
    <div
      className={`${styles.headline}${visible ? ` ${styles.on}` : ''}`}
      aria-hidden="true"
      aria-live="off"
    >
      <div className={styles.headlinePlate}>SYSTEM FAILURE</div>
    </div>
  );
}
