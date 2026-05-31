// components/responsive/MobileTitleBar/MobileTitleBar.client.tsx
'use client';

import { WindowChrome } from '@/design-system';

export function MobileTitleBar() {
  return (
    <div className="sticky top-7 z-[109] flex items-center gap-2.5 px-[14px] py-2.5 bg-surface border-b border-signal-subtle text-xs uppercase tracking-[0.14em]">
      <WindowChrome size={9} />
      <div className="flex-1 text-center text-signal font-bold" aria-hidden="true">
        ERIK_CUNHA.SH
      </div>
      <div aria-hidden="true" />
    </div>
  );
}
