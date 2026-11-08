'use client';

import { cn } from '@/lib/cn';
import { DRAWER_ID, MENU_TRIGGER_CLASS } from './navigationIds';
import { useDrawerOpen, useSectionNavigation } from './SectionNavigationProvider.client';

export const MENU_ICON_PATH = 'M4 7h16M4 12h16M4 17h16';
const ICON_VIEWBOX = '0 0 24 24';

export function NavIcon({ path, focusable }: { path: string; focusable?: boolean }) {
  return (
    <svg viewBox={ICON_VIEWBOX} aria-hidden="true" focusable={focusable}>
      <path d={path} />
    </svg>
  );
}

export function MenuTrigger({ className }: { className?: string }) {
  const { openDrawer, copy } = useSectionNavigation();
  const drawerOpen = useDrawerOpen();
  return (
    <button
      type="button"
      className={cn(MENU_TRIGGER_CLASS, className)}
      aria-label={copy.openMenu}
      aria-expanded={drawerOpen}
      aria-controls={DRAWER_ID}
      aria-haspopup="dialog"
      onClick={(event) => openDrawer(event.currentTarget)}
    >
      <NavIcon path={MENU_ICON_PATH} focusable={false} />
    </button>
  );
}
