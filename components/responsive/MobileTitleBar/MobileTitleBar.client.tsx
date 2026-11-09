'use client';

import type { ReactNode } from 'react';
import { LanguageSwitch, MenuTrigger } from '../SectionNavigation';

export function MobileTitleBar({ brand }: { brand: ReactNode }) {
  return (
    <header className="mobile-title-bar sticky top-7 z-(--z-title-bar) grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 px-[var(--space-gutter)] py-2.5 bg-secondary-950 border-b border-primary-subtle">
      <div className="justify-self-start">
        <MenuTrigger />
      </div>
      <div className="justify-self-center">
        <LanguageSwitch />
      </div>
      <div className="justify-self-end">{brand}</div>
    </header>
  );
}
