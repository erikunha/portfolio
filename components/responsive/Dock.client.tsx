'use client';

import { dispatchModuleOpen } from '@/lib/events';
import styles from './Dock.module.css';

const ITEMS = [
  {
    label: 'HOME',
    target: 'sec-readme',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 11l9-8 9 8v10H3z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    label: 'WORK',
    target: 'sec-projects',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 7l3-3h5l2 3h8v13H3z" />
      </svg>
    ),
  },
  {
    label: 'PERF',
    target: 'sec-perf-receipts',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 18l5-6 4 4 5-7 4 5" />
        <path d="M3 21h18" />
      </svg>
    ),
  },
  {
    label: 'SHELL',
    target: 'sec-shell',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h16v16H4z" />
        <path d="M7 9l3 3-3 3M12 16h5" />
      </svg>
    ),
  },
  {
    label: 'HIRE',
    target: 'sec-contact',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <polygon points="6,4 20,12 6,20" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

export function Dock() {
  const onJump = (target: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(target);
    if (!el) return;
    // Dispatch a custom event so MobileModule React state opens — avoids
    // direct DOM mutation which desyncs from React state and breaks on re-render.
    if (el.classList.contains('module--mobile')) {
      dispatchModuleOpen(target);
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className={styles.root} aria-label="primary">
      {ITEMS.map((it) => (
        <a key={it.target} href={`#${it.target}`} onClick={onJump(it.target)}>
          {it.icon}
          {it.label}
        </a>
      ))}
    </nav>
  );
}
