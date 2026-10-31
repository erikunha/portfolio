import { NAV_VOCABULARY } from './nav';
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
};

export type NavigationCopy = {
  drawerLabel: string;
  navLabel: string;
  title: string;
  indexGlyph: string;
  indexLabel: string;
  closeDrawer: string;
  dockLabel: string;
  positionLabel: string;
  menuLabelPrefix: string;
  newTabSuffix: string;
  searchLabel: string;
  searchShortcutApple: string;
  searchShortcutOther: string;
  motionOn: string;
  motionOff: string;
  sectionCountLabel: string;
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
    indexGlyph: '☰',
    indexLabel: 'INDEX',
    closeDrawer: '[ X ] CLOSE',
    dockLabel: 'primary',
    positionLabel: 'Page position',
    menuLabelPrefix: 'MENU, section',
    newTabSuffix: ' (opens in a new tab)',
    searchLabel: 'SEARCH',
    searchShortcutApple: '⌘K',
    searchShortcutOther: 'Ctrl K',
    motionOn: 'MOTION: ON',
    motionOff: 'MOTION: OFF',
    sectionCountLabel: 'sections',
  },
  groups: [
    { id: 'whoami', title: 'WHOAMI', dock: 'home', sectionIds: ['bio', 'sec-readme'] },
    { id: 'work', title: 'WORK', dock: 'work', sectionIds: ['sec-projects', 'sec-git-log'] },
    { id: 'live', title: 'MEASURED', dock: 'shell', sectionIds: ['sec-shell', 'sec-live-metrics'] },
    {
      id: 'off-hours',
      title: 'OFF_HOURS',
      dock: 'menu',
      sectionIds: ['sec-hottest-takes', 'sec-guitar'],
    },
    { id: 'contact', title: 'CONTACT', dock: 'menu', sectionIds: ['sec-contact'] },
  ],
  dock: [
    { key: 'home', label: 'HOME', sectionId: 'bio' },
    { key: 'work', label: NAV_VOCABULARY.work, sectionId: 'sec-projects' },
    { key: 'shell', label: 'SHELL', sectionId: 'sec-shell' },
    {
      key: 'hire',
      label: 'HIRE ↗',
      href: LINKEDIN_URL,
      accessibleName: 'Hire me on LinkedIn, opens in a new tab',
    },
    { key: 'menu', label: 'MENU' },
  ],
  siteLinks: [
    { label: CV_LINK_LABEL, index: 'CV', href: READING_PATHS.cv, external: false },
    { label: NAV_VOCABULARY.summary, index: '30', href: READING_PATHS.summary, external: false },
    { label: NAV_VOCABULARY.designSystem, index: 'DS', href: '/design-system', external: false },
    { label: NAV_VOCABULARY.linkedin, index: '↗', href: LINKEDIN_URL, external: true },
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

export function formatSectionPosition(id: string): string {
  const index = Math.max(
    0,
    SECTION_NAV.findIndex((section) => section.id === id),
  );
  return `${formatSectionNumber(index + 1)}/${SECTION_NAV.length}`;
}

export function dockKeyForSection(id: string): DockKey | undefined {
  return NAVIGATION.groups.find((group) => group.sectionIds.some((member) => member === id))?.dock;
}
