'use client';

import { useEffect, useState } from 'react';
import styles from './StatusBar.module.css';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function fmtClock(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StatusBar() {
  // Empty string on first render — dynamicIO prohibits new Date() during
  // prerender outside a Suspense boundary. suppressHydrationWarning on the
  // span handles the server/client mismatch. The clock starts in useEffect.
  const [time, setTime] = useState('');

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    function startClock() {
      setTime(fmtClock(new Date()));
      id = setInterval(() => setTime(fmtClock(new Date())), 15_000);
    }

    function onVisibility() {
      if (document.hidden) {
        if (id !== null) {
          clearInterval(id);
          id = null;
        }
      } else {
        startClock();
      }
    }

    startClock();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (id !== null) clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className={styles.root} role="status" aria-label="device status">
      <div className={styles.left}>
        <span className={styles.time} suppressHydrationWarning>
          {time}
        </span>
        <span className={styles.carrier}>DEV_OS</span>
      </div>
      <div className={styles.right} aria-hidden>
        <span className={styles.signal}>
          <i style={{ height: 4 }} />
          <i style={{ height: 7 }} />
          <i style={{ height: 10 }} />
          <i style={{ height: 13, opacity: 0.5 }} />
        </span>
        <span className={styles.cell}>5G</span>
        <span className={styles.battery} aria-hidden>
          <span className={styles.batteryNum}>78%</span>
          <span className={styles.batteryBox}>
            <i />
          </span>
        </span>
      </div>
    </div>
  );
}
