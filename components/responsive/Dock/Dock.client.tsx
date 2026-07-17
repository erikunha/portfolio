'use client';

type DockItem = {
  label: string;
  href: string;
  target?: string;
  icon: React.ReactNode;
};

const ITEMS: DockItem[] = [
  {
    label: 'HOME',
    href: '/#sec-readme',
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
    href: '/#sec-projects',
    target: 'sec-projects',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 7l3-3h5l2 3h8v13H3z" />
      </svg>
    ),
  },
  {
    label: 'PERF',
    href: '/#sec-perf-receipts',
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
    href: '/#sec-shell',
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
    href: '/#sec-contact',
    target: 'sec-contact',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <polygon points="6,4 20,12 6,20" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: 'DS',
    href: '/design-system',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" />
        <rect x="13" y="3" width="8" height="8" />
        <rect x="3" y="13" width="8" height="8" />
        <rect x="13" y="13" width="8" height="8" />
      </svg>
    ),
  },
];

export function Dock() {
  const onJump = (target?: string) => (e: React.MouseEvent) => {
    if (!target) return;
    const el = document.getElementById(target);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  };

  return (
    <nav
      className="dock fixed left-0 right-0 bottom-0 z-[120] pb-[calc(8px+env(safe-area-inset-bottom,0px))] pt-2 px-2 bg-[rgba(0,0,0,0.92)] backdrop-blur-md border-t border-primary-subtle grid grid-cols-6 gap-0.5"
      aria-label="primary"
    >
      {ITEMS.map((it) => (
        <a
          key={it.href}
          href={it.href}
          onClick={onJump(it.target)}
          className="flex flex-col items-center justify-center gap-[3px] py-1.5 px-1 text-primary-400 text-xs tracking-[0.1em] uppercase min-h-12 rounded-[4px] active:bg-primary-faint [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:stroke-current [&_svg]:fill-none [&_svg]:[stroke-width:1.6]"
        >
          {it.icon}
          {it.label}
        </a>
      ))}
    </nav>
  );
}
