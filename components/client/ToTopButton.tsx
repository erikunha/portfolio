'use client';

import { useEffect, useRef } from 'react';

export function ToTopButton() {
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const onScroll = () => {
      btn.classList.toggle('show', window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      ref={btnRef}
      className="totop"
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
