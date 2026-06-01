'use client';

import { useEffect, useState } from 'react';

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
      className={visible ? 'to-top-btn to-top-show' : 'to-top-btn'}
      aria-label="back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      type="button"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        width="16"
        height="16"
        stroke="currentColor"
        fill="none"
        strokeWidth="2"
      >
        <path d="M6 14l6-6 6 6" />
      </svg>
    </button>
  );
}
