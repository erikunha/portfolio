// components/responsive/CRTOverlay.tsx
'use client';

import { useEffect } from 'react';
import { applyMotion, readMotion } from '@/lib/motion';
import styles from './CRTOverlay.module.css';

export function CRTOverlay() {
  useEffect(() => {
    // Keep in sync with OS-level prefers-reduced-motion changes (e.g. user
    // switches system settings while the tab is open). Only react if the user
    // hasn't explicitly toggled via DesktopTopbar (stored preference takes
    // precedence — readMotion() already handles that priority).
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => applyMotion(readMotion());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <>
      <div className={styles.vignette} aria-hidden />
      <div className={styles.overlay} aria-hidden />
      <div className={styles.mask} aria-hidden />
      <div className={styles.noise} aria-hidden />
      <div className={styles.flicker} aria-hidden />
      <div className={styles.scanBeam} aria-hidden />
    </>
  );
}
