import type { SVGProps } from 'react';
import type { PillIcon } from '@/content/links.constants';

type IconProps = SVGProps<SVGSVGElement>;

const baseProps: IconProps = {
  viewBox: '0 0 24 24',
  width: 15,
  height: 15,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  'aria-hidden': true,
  focusable: false,
};

export function IconYouTube({ size = 20 }: { size?: number }) {
  return (
    <svg {...baseProps} width={size} height={size}>
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="M10 9.4l5.2 2.6L10 14.6z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconPortfolio() {
  return (
    <svg {...baseProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 8.5h18M6.4 6.2h.1M9 6.2h.1" />
    </svg>
  );
}

function IconGitHub() {
  return (
    <svg {...baseProps}>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="17" cy="12" r="2.4" />
      <path d="M6 8.4v7.2M8.4 6h4.6a2 2 0 012 2v1.6" />
    </svg>
  );
}

function IconLinkedIn() {
  return (
    <svg {...baseProps}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7.6 10.6v6M7.6 7.4v.2M12 16.6v-3.4a2 2 0 014 0v3.4" />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg {...baseProps}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconTikTok() {
  return (
    <svg {...baseProps}>
      <path d="M9.5 21a4.5 4.5 0 104.5-4.5V3" />
      <path d="M14 3.4c.6 2.6 2.4 4.2 5 4.4" />
    </svg>
  );
}

function IconEmail() {
  return (
    <svg {...baseProps}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M3.4 7l8.6 5.6L20.6 7" />
    </svg>
  );
}

export function IconCopy() {
  return (
    <svg {...baseProps}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 6H6a2 2 0 00-2 2v9" />
    </svg>
  );
}

const PILL_ICONS: Record<PillIcon, () => React.JSX.Element> = {
  portfolio: IconPortfolio,
  github: IconGitHub,
  linkedin: IconLinkedIn,
  instagram: IconInstagram,
  tiktok: IconTikTok,
  email: IconEmail,
};

export function PillGlyph({ icon }: { icon: PillIcon }) {
  const Glyph = PILL_ICONS[icon];
  return <Glyph />;
}
