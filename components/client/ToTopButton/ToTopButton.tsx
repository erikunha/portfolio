'use client';

import { useEffect, useState } from 'react';
import { readMotion } from '@/lib/motion';
import { useSectionNavigation } from '../../responsive/SectionNavigation';

export function ToTopButton() {
  const { copy } = useSectionNavigation();
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
      aria-label={copy.backToTopLabel}
      onClick={() => window.scrollTo({ top: 0, behavior: readMotion() ? 'smooth' : 'auto' })}
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
