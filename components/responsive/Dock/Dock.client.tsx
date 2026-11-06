'use client';

import type { DockKey } from '@/content/navigation';
import { DRAWER_ID, MENU_ICON_PATH, NavIcon, useSectionNavigation } from '../SectionNavigation';

const ICON_PATHS: Record<DockKey, string> = {
  home: 'M3 11l9-8 9 8v10H3zM9 21V12h6v9',
  work: 'M3 7l3-3h5l2 3h8v13H3z',
  shell: 'M4 4h16v16H4zM7 9l3 3-3 3M12 16h5',
  hire: 'M7 17L17 7M9 7h8v8',
  menu: MENU_ICON_PATH,
};

function DockIcon({ control }: { control: DockKey }) {
  return <NavIcon path={ICON_PATHS[control]} />;
}

export function Dock() {
  const { currentId, drawerOpen, openDrawer, closeDrawer, jump, copy, chrome } =
    useSectionNavigation();
  const active = chrome.dockKeyBySection[currentId];
  const navigation = chrome.navigation;

  return (
    <nav className="dock" aria-label={copy.dockLabel} data-position-target="">
      {navigation.dock.map(({ key, label, sectionId, href, accessibleName }) => {
        const current = active === key ? 'location' : undefined;
        if (key === 'menu') {
          return (
            <button
              key={key}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
              aria-controls={DRAWER_ID}
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
            href={sectionId ? (chrome.sectionHrefs[sectionId] ?? '/') : '/'}
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
