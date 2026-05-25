'use client';

import { useLayoutEffect, useState } from 'react';
import { applyMotion, readMotion } from '@/lib/motion';
import styles from './DesktopTopbar.module.css';

export function DesktopTopbar() {
  const [motionOn, setMotionOn] = useState(true);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const on = readMotion();
    setMotionOn(on);
    applyMotion(on);
  }, []);

  function toggleMotion() {
    const next = !motionOn;
    setMotionOn(next);
    applyMotion(next);
  }

  return (
    <div className={styles.root}>
      <div className={styles.inner}>
        <div className={styles.dots} aria-hidden="true">
          <span className={`${styles.dot} ${styles.dotRed}`} />
          <span className={`${styles.dot} ${styles.dotYellow}`} />
          <span className={`${styles.dot} ${styles.dotGreen}`} />
        </div>
        <div className={styles.tabs}>
          <div className={`${styles.tab} ${styles.tabActive}`}>
            <span>&#9632;</span>
            <span>ERIK_CUNHA.SH</span>
            <span className={styles.tabClose}>&times;</span>
          </div>
          <div className={styles.tab}>
            <span>&#9635;</span>
            <span>PROJECTS</span>
          </div>
        </div>
        <nav className={styles.nav} aria-label="Site navigation">
          <a className={styles.navlink} href="#bio">
            01_BIO
          </a>
          <a className={styles.navlink} href="#sec-projects">
            02_WORK
          </a>
          <a className={styles.navlink} href="#sec-git-log">
            03_LOGS
          </a>
          <a className={styles.navlink} href="#sec-npm-stack">
            04_DEPS
          </a>
          <a className={styles.navlink} href="/design-system">
            DESIGN_SYSTEM
          </a>
          <button
            type="button"
            className={styles.motion}
            onClick={toggleMotion}
            data-motion={motionOn ? 'on' : 'off'}
            aria-pressed={motionOn}
          >
            <span className={styles.mdot} aria-hidden="true" />
            <span>{motionOn ? 'MOTION: ON' : 'MOTION: OFF'}</span>
          </button>
          <a className={styles.btnOutline} href="/erik-cunha-cv.pdf" download>
            DOWNLOAD_CV
          </a>
          <a
            className={styles.btnPrimary}
            href="https://www.linkedin.com/in/erikunha/"
            target="_blank"
            rel="noreferrer noopener"
          >
            SSH_CONNECT
            <span className="sr-only"> (opens in new window)</span>
          </a>
        </nav>
      </div>
    </div>
  );
}
