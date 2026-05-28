// components/Icons/Icons.tsx
// Inline SVG icons used in section headers. Paths lifted verbatim from
// prototype/Portfolio.html. Each icon renders at 14×14 with a 1.4 stroke
// in --ds-color-signal via `currentColor`.

import type { JSX } from 'react';

type IconProps = JSX.IntrinsicElements['svg'];

const baseProps: IconProps = {
  viewBox: '0 0 24 24',
  width: 14,
  height: 14,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  'aria-hidden': true,
  focusable: false,
};

// CAT README.MD — file with 3 lines
export function IconReadme() {
  return (
    <svg {...baseProps}>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h7M9 16h7M9 10h3" />
    </svg>
  );
}

// MAN ERIK(1) — file with 3 lines (slightly different rows)
export function IconManPage() {
  return (
    <svg {...baseProps}>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 12h7M9 15h7M9 18h5" />
    </svg>
  );
}

// CAT ~/.NOW — clock
export function IconNow() {
  return (
    <svg {...baseProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

// LS -LA ./PROJECTS — folder
export function IconProjects() {
  return (
    <svg {...baseProps}>
      <path d="M3 7l3-3h5l2 3h8v13H3z" />
    </svg>
  );
}

// GIT LOG — clock (mockup reuses the clock for the log timestamp framing)
export function IconGitLog() {
  return (
    <svg {...baseProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

// NPM LIST --GLOBAL — list
export function IconNpmStack() {
  return (
    <svg {...baseProps}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

// SYS_HEALTH_MONITOR — heart
export function IconSysHealth() {
  return (
    <svg {...baseProps}>
      <path d="M12 21s-7-4.5-7-11a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 6.5-7 11-7 11z" />
    </svg>
  );
}

// ./EXEC INTERACTIVE_SHELL — terminal window
export function IconShell() {
  return (
    <svg {...baseProps}>
      <path d="M4 4h16v16H4z" />
      <path d="M7 9l3 3-3 3M12 16h5" />
    </svg>
  );
}

// LIVE_PERF.JSON — line chart
export function IconLivePerf() {
  return (
    <svg {...baseProps}>
      <path d="M3 18l5-6 4 4 5-7 4 5" />
      <path d="M3 21h18" />
    </svg>
  );
}

// PERF_RECEIPTS — bar chart
export function IconPerfReceipts() {
  return (
    <svg {...baseProps}>
      <path d="M3 21V3M3 21h18M7 17V10M11 17V7M15 17V12M19 17V5" />
    </svg>
  );
}

// CAT ~/.GUITAR_RIG — guitar pick / J-shape
export function IconGuitar() {
  return (
    <svg {...baseProps}>
      <path d="M6 3v11a3 3 0 1 0 3 3V6h7V3z" />
    </svg>
  );
}

// CAT ~/.VISA — globe with meridians
export function IconVisa() {
  return (
    <svg {...baseProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

// CAT ~/.CREDENTIALS — wallet / card
export function IconCredentials() {
  return (
    <svg {...baseProps}>
      <rect x="3" y="6" width="18" height="13" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  );
}

// CAT ~/.COMMUNITY — two figures
export function IconCommunity() {
  return (
    <svg {...baseProps}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14 20a5 5 0 0 1 7-4.6" />
    </svg>
  );
}

// HOTTEST_TAKES — flame
export function IconHottestTakes() {
  return (
    <svg {...baseProps}>
      <path d="M12 3c2 4-2 5 0 8 2-2 4-1 4 3a6 6 0 1 1-10-3c1 2 3 2 3-1 0-3 1-5 3-7z" />
    </svg>
  );
}

// LS -LA ~/RESPONSIBILITIES — padlock
export function IconResponsibilities() {
  return (
    <svg {...baseProps}>
      <rect x="5" y="11" width="14" height="10" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      <path d="M9 16h6" />
    </svg>
  );
}

// CAT ~/.UNKNOWNS — question mark in circle
export function IconUnknowns() {
  return (
    <svg {...baseProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 1 1 4 2.8c-.7.3-1 .7-1 1.7M12 17h.01" />
    </svg>
  );
}

// ASK_EVAL.JSON — gauge / checkmark dial
export function IconAiMetrics() {
  return (
    <svg {...baseProps}>
      <path d="M4 14a8 8 0 0 1 16 0" />
      <path d="M12 14l4-3" />
      <path d="M3 18h18" />
    </svg>
  );
}

// SUDO CONTACT --INIT — play triangle (filled)
export function IconContact() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="currentColor"
      stroke="none"
      aria-hidden
      focusable={false}
    >
      <polygon points="6,4 20,12 6,20" />
    </svg>
  );
}

// ./MIX --LIVE — three fader bars at different heights
export function IconMixer() {
  return (
    <svg {...baseProps}>
      <line x1="6" y1="5" x2="6" y2="19" />
      <line x1="12" y1="9" x2="12" y2="19" />
      <line x1="18" y1="3" x2="18" y2="19" />
      <rect x="3" y="8" width="6" height="2" />
      <rect x="9" y="13" width="6" height="2" />
      <rect x="15" y="6" width="6" height="2" />
    </svg>
  );
}
