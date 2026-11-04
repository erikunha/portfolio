import { HIRE_ACCESSIBLE_NAME, HIRE_SHORT_LABEL, NAV_VOCABULARY } from './nav';
import { CV_LINK_LABEL, READING_PATHS } from './reading-paths';
import { SECTION_NAV, type SectionId } from './section-registry';
import { LINKEDIN_URL } from './social-urls';

export type DockKey = 'home' | 'work' | 'shell' | 'hire' | 'menu';

export type NavGroup = {
  id: string;
  title: string;
  dock: DockKey;
  sectionIds: readonly SectionId[];
};

export type DockControl = {
  key: DockKey;
  label: string;
  sectionId?: SectionId;
  href?: string;
  accessibleName?: string;
};

export type SiteLink = {
  label: string;
  index: string;
  href: string;
  external: boolean;
  accessibleName?: string;
};

export type NavigationCopy = {
  drawerLabel: string;
  navLabel: string;
  title: string;
  openMenu: string;
  closeDrawer: string;
  dockLabel: string;
  positionLabel: string;
  searchLabel: string;
  searchShortcutApple: string;
  searchShortcutOther: string;
  motionOn: string;
  motionOff: string;
  motionReduced: string;
};

export type Navigation = {
  copy: NavigationCopy;
  groups: readonly NavGroup[];
  dock: readonly DockControl[];
  siteLinks: readonly SiteLink[];
};

export const NAVIGATION: Navigation = {
  copy: {
    drawerLabel: 'Section menu',
    navLabel: 'Page sections',
    title: '~/index',
    openMenu: 'Open menu',
    closeDrawer: '[ X ] CLOSE',
    dockLabel: 'primary',
    positionLabel: 'Page position',
    searchLabel: 'SEARCH',
    searchShortcutApple: '⌘K',
    searchShortcutOther: 'Ctrl K',
    motionOn: 'MOTION: ON',
    motionOff: 'MOTION: OFF',
    motionReduced: 'MOTION: REDUCED',
  },
  groups: [
    { id: 'whoami', title: 'WHOAMI', dock: 'home', sectionIds: ['bio', 'sec-readme'] },
    { id: 'work', title: 'WORK', dock: 'work', sectionIds: ['sec-projects', 'sec-git-log'] },
    { id: 'live', title: 'MEASURED', dock: 'shell', sectionIds: ['sec-shell', 'sec-live-metrics'] },
    {
      id: 'off-hours',
      title: 'OFF_HOURS',
      dock: 'menu',
      sectionIds: ['sec-hottest-takes', 'sec-guitar', 'sec-daw-mixer'],
    },
    { id: 'contact', title: 'CONTACT', dock: 'menu', sectionIds: ['sec-contact'] },
  ],
  dock: [
    { key: 'home', label: 'HOME', sectionId: 'bio' },
    { key: 'work', label: NAV_VOCABULARY.work, sectionId: 'sec-projects' },
    { key: 'shell', label: 'SHELL', sectionId: 'sec-shell' },
    {
      key: 'hire',
      label: HIRE_SHORT_LABEL,
      href: LINKEDIN_URL,
      accessibleName: HIRE_ACCESSIBLE_NAME,
    },
    { key: 'menu', label: 'MENU' },
  ],
  siteLinks: [
    { label: CV_LINK_LABEL, index: 'CV', href: READING_PATHS.cv, external: false },
    { label: NAV_VOCABULARY.summary, index: '30', href: READING_PATHS.summary, external: false },
    { label: NAV_VOCABULARY.links, index: 'LK', href: '/links', external: false },
    { label: NAV_VOCABULARY.designSystem, index: 'DS', href: '/design-system', external: false },
    {
      label: NAV_VOCABULARY.linkedin,
      index: '↗',
      href: LINKEDIN_URL,
      external: true,
      accessibleName: HIRE_ACCESSIBLE_NAME,
    },
  ],
};

const POSITION_DIGITS = 2;

export const HOME_SECTION_ID: SectionId = SECTION_NAV[0].id;

export function sectionHref(id: string): string {
  return `/#${id}`;
}

export function formatSectionNumber(order: number): string {
  return String(order).padStart(POSITION_DIGITS, '0');
}

export function dockKeyForSection(id: string): DockKey | undefined {
  return NAVIGATION.groups.find((group) => group.sectionIds.some((member) => member === id))?.dock;
}
