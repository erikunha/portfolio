'use client';

import type { ReactNode } from 'react';
import { LanguageSwitch, MenuTrigger } from '../SectionNavigation';

export function MobileTitleBar({ brand }: { brand: ReactNode }) {
  return (
    <div className="mobile-title-bar sticky top-7 z-[109] flex items-center gap-2.5 px-[14px] py-2.5 bg-secondary-950 border-b border-primary-subtle">
      <MenuTrigger />
      <div className="ml-auto flex items-center gap-2.5">
        <LanguageSwitch />
        {brand}
      </div>
    </div>
  );
}
