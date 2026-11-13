import type { ReactNode } from 'react';
import { BREAK_AFTER, BreakAfter } from '@/components/BreakAfter';

export type LineContentProps = {
  glyph: ReactNode;
  label: string;
  host: string;
  arrow: string;
};

export function LineContent({ glyph, label, host, arrow }: LineContentProps) {
  return (
    <>
      <span className="links-line-glyph" aria-hidden="true">
        {glyph}
      </span>
      <span className="links-line-label">{label}</span>
      <span className="links-line-host">
        <BreakAfter chars={BREAK_AFTER.host}>{host}</BreakAfter>
      </span>
      <span className="links-line-arrow" aria-hidden="true">
        {arrow}
      </span>
    </>
  );
}
