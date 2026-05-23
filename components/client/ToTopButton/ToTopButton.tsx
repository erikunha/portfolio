'use client';

import { useEffect, useState } from 'react';
import styles from './ToTopButton.module.css';

export function ToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () =>
      setVisible((v) => {
        const next = window.scrollY > 400;
        return v === next ? v : next;
      });
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      className={visible ? `${styles.root} ${styles.show}` : styles.root}
      aria-label="back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      type="button"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 14l6-6 6 6" />
      </svg>
    </button>
  );
}
