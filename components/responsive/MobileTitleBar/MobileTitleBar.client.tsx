'use client';

import { topbarChrome } from '@/content/terminal-chrome';
import { WindowChrome } from '@/design-system';
import { IndexTrigger } from '../SectionNavigation';

export function MobileTitleBar() {
  return (
    <div className="mobile-title-bar sticky top-7 z-[109] flex items-center gap-2.5 px-[14px] py-2.5 bg-secondary-950 border-b border-primary-subtle text-xs uppercase tracking-[0.14em]">
      <IndexTrigger className="normal-case" />
      <div className="flex-1 text-center text-primary-500 font-bold" aria-hidden="true">
        {topbarChrome.brandLabel}
      </div>
      <WindowChrome size={9} />
    </div>
  );
}
