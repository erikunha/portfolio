'use client';

import {
  type DockKey,
  dockKeyForSection,
  formatSectionPosition,
  NAVIGATION,
  sectionHref,
} from '@/content/navigation';
import { useSectionNavigation } from '../SectionNavigation';

const ICON_PATHS: Record<DockKey, string> = {
  home: 'M3 11l9-8 9 8v10H3zM9 21V12h6v9',
  work: 'M3 7l3-3h5l2 3h8v13H3z',
  shell: 'M4 4h16v16H4zM7 9l3 3-3 3M12 16h5',
  hire: 'M7 17L17 7M9 7h8v8',
  menu: 'M4 7h16M4 12h16M4 17h16',
};

function DockIcon({ control }: { control: DockKey }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICON_PATHS[control]} />
    </svg>
  );
}

export function Dock() {
  const { currentId, drawerOpen, openDrawer, closeDrawer, jump } = useSectionNavigation();
  const active = dockKeyForSection(currentId);

  return (
    <nav className="dock" aria-label={NAVIGATION.copy.dockLabel} data-position-target="">
      {NAVIGATION.dock.map(({ key, label, sectionId, href, accessibleName }) => {
        const current = active === key ? 'location' : undefined;
        if (key === 'menu') {
          return (
            <button
              key={key}
              type="button"
              aria-label={`${NAVIGATION.copy.menuLabelPrefix} ${formatSectionPosition(currentId)}`}
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
              aria-controls="section-drawer"
              aria-current={current}
              onClick={(event) =>
                drawerOpen ? closeDrawer(true) : openDrawer(event.currentTarget)
              }
            >
              <DockIcon control={key} />
              {label}
            </button>
          );
        }
        if (href) {
          return (
            <a
              key={key}
              href={href}
              className="dock-hire"
              target="_blank"
              rel="noreferrer noopener"
              aria-label={accessibleName}
            >
              <DockIcon control={key} />
              {label}
            </a>
          );
        }
        return (
          <a
            key={key}
            href={sectionId ? sectionHref(sectionId) : '/'}
            aria-current={current}
            onClick={(event) => sectionId && jump(event, sectionId)}
          >
            <DockIcon control={key} />
            {label}
          </a>
        );
      })}
    </nav>
  );
}
