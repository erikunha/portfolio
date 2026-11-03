'use client';

import { topbarChrome } from '@/content/terminal-chrome';
import { WindowChrome } from '@/design-system';
import { BrandLink, MenuTrigger } from '../SectionNavigation';

export function MobileTitleBar() {
  return (
    <div className="mobile-title-bar sticky top-7 z-[109] grid grid-cols-[var(--spacing-target)_minmax(0,1fr)_var(--spacing-target)] items-center gap-2.5 px-[14px] py-2.5 bg-secondary-950 border-b border-primary-subtle text-xs uppercase tracking-[0.14em]">
      <MenuTrigger />
      <BrandLink className="inline-flex min-h-[var(--spacing-target)] items-center justify-center text-primary-500 font-bold no-underline hover:no-underline">
        {topbarChrome.brandLabel}
      </BrandLink>
      <div className="justify-self-end">
        <WindowChrome size={9} />
      </div>
    </div>
  );
}
