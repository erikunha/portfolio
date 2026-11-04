import {
  HIRE_ACCESSIBLE_NAME,
  HIRE_SHORT_LABEL,
  NAV_VOCABULARY,
  TOPBAR_HIRE_LINK,
  TOPBAR_NAV,
  TOPBAR_READING_LINK,
  type TopbarNavLink,
} from './nav';
import { CV_LINK_LABEL, READING_PATHS } from './reading-paths';
import { SECTION_NAV, type SectionId } from './section-registry';
import { localizedPath, SITE_LOCALE, type SiteLocale } from './site-locale';
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
  langSwitchLabel: string;
};

export type Navigation = {
  copy: NavigationCopy;
  groups: readonly NavGroup[];
  dock: readonly DockControl[];
  siteLinks: readonly SiteLink[];
};

// Client islands (drawer, dock, topbar, position meter) receive the picked
// locale's Navigation as props, so both languages never enter one chunk. This
// module stays zod-free for the same reason; createNavigationSchema in
// ./schemas validates each locale copy.
const navigationFor = (locale: SiteLocale): Navigation => {
  const pt = locale === SITE_LOCALE.pt;
  return {
    copy: {
      drawerLabel: pt ? 'Menu de seções' : 'Section menu',
      navLabel: pt ? 'Seções da página' : 'Page sections',
      title: '~/index',
      openMenu: pt ? 'Abrir menu' : 'Open menu',
      closeDrawer: pt ? '[ X ] FECHAR' : '[ X ] CLOSE',
      dockLabel: pt ? 'principal' : 'primary',
      positionLabel: pt ? 'Posição na página' : 'Page position',
      searchLabel: pt ? 'BUSCAR' : 'SEARCH',
      searchShortcutApple: '⌘K',
      searchShortcutOther: 'Ctrl K',
      motionOn: 'MOTION: ON',
      motionOff: 'MOTION: OFF',
      motionReduced: 'MOTION: REDUCED',
      langSwitchLabel: pt ? 'Idioma' : 'Language',
    },
    groups: [
      {
        id: 'whoami',
        title: pt ? 'QUEM SOU' : 'WHOAMI',
        dock: 'home',
        sectionIds: ['bio', 'sec-readme'],
      },
      {
        id: 'work',
        title: pt ? 'PROJETOS' : 'WORK',
        dock: 'work',
        sectionIds: ['sec-projects', 'sec-git-log'],
      },
      {
        id: 'live',
        title: pt ? 'MEDIÇÕES' : 'MEASURED',
        dock: 'shell',
        sectionIds: ['sec-shell', 'sec-live-metrics'],
      },
      {
        id: 'off-hours',
        title: pt ? 'HOBBIES' : 'OFF_HOURS',
        dock: 'menu',
        sectionIds: ['sec-hottest-takes', 'sec-guitar', 'sec-daw-mixer'],
      },
      {
        id: 'contact',
        title: pt ? 'CONTATO' : 'CONTACT',
        dock: 'menu',
        sectionIds: ['sec-contact'],
      },
    ],
    dock: [
      { key: 'home', label: pt ? 'INÍCIO' : 'HOME', sectionId: 'bio' },
      { key: 'work', label: NAV_VOCABULARY[locale].work, sectionId: 'sec-projects' },
      { key: 'shell', label: 'SHELL', sectionId: 'sec-shell' },
      {
        key: 'hire',
        label: HIRE_SHORT_LABEL[locale],
        href: LINKEDIN_URL,
        accessibleName: HIRE_ACCESSIBLE_NAME[locale],
      },
      { key: 'menu', label: 'MENU' },
    ],
    siteLinks: [
      {
        label: CV_LINK_LABEL[locale],
        index: 'CV',
        href: localizedPath(locale, READING_PATHS.cv),
        external: false,
      },
      {
        label: NAV_VOCABULARY[locale].summary,
        index: '30',
        href: localizedPath(locale, READING_PATHS.summary),
        external: false,
      },
      { label: NAV_VOCABULARY[locale].links, index: 'LK', href: '/links', external: false },
      {
        label: NAV_VOCABULARY[locale].designSystem,
        index: 'DS',
        href: '/design-system',
        external: false,
      },
      {
        label: NAV_VOCABULARY[locale].linkedin,
        index: '↗',
        href: LINKEDIN_URL,
        external: true,
        accessibleName: HIRE_ACCESSIBLE_NAME[locale],
      },
    ],
  };
};

export const NAVIGATION: Record<SiteLocale, Navigation> = {
  [SITE_LOCALE.en]: navigationFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: navigationFor(SITE_LOCALE.pt),
};

const POSITION_DIGITS = 2;

export const HOME_SECTION_ID: SectionId = SECTION_NAV[0].id;

export function sectionHref(locale: SiteLocale, id: string): string {
  return locale === SITE_LOCALE.pt ? `/pt#${id}` : `/#${id}`;
}

export function formatSectionNumber(order: number): string {
  return String(order).padStart(POSITION_DIGITS, '0');
}

export function dockKeyForSection(id: string): DockKey | undefined {
  return NAVIGATION[SITE_LOCALE.en].groups.find((group) =>
    group.sectionIds.some((member) => member === id),
  )?.dock;
}

export type DrawerSection = {
  id: SectionId;
  label: string;
  order: number;
  href: string;
};

export type DrawerGroup = {
  id: string;
  title: string;
  sections: readonly DrawerSection[];
};

// Pre-resolved drawer rows for one locale: labels and hash hrefs are baked in
// on the server so the client islands never read the bilingual navigation.
export function drawerGroups(locale: SiteLocale): readonly DrawerGroup[] {
  return NAVIGATION[locale].groups.map((group) => ({
    id: group.id,
    title: group.title,
    sections: group.sectionIds.map((id) => {
      const section = SECTION_NAV.find((candidate) => candidate.id === id);
      if (!section) throw new Error(`navigation: unknown section "${id}"`);
      return {
        id,
        label: section.label[locale],
        order: section.order,
        href: sectionHref(locale, id),
      };
    }),
  }));
}

export type SiteNavChrome = {
  navigation: Navigation;
  drawerGroups: readonly DrawerGroup[];
  topbarNav: readonly TopbarNavLink[];
  topbarReading: TopbarNavLink;
  topbarHire: TopbarNavLink & { accessibleName: string };
  // Structural, locale-free section maps, pre-resolved on the server so the
  // dock never reads the bilingual navigation module at runtime.
  sectionHrefs: Readonly<Record<string, string>>;
  dockKeyBySection: Readonly<Record<string, DockKey>>;
};

export function siteNavChrome(locale: SiteLocale): SiteNavChrome {
  const groups = NAVIGATION[locale].groups;
  return {
    navigation: NAVIGATION[locale],
    drawerGroups: drawerGroups(locale),
    topbarNav: TOPBAR_NAV[locale],
    topbarReading: TOPBAR_READING_LINK[locale],
    topbarHire: TOPBAR_HIRE_LINK(locale),
    sectionHrefs: Object.fromEntries(
      drawerGroups(locale).flatMap((group) => group.sections.map(({ id, href }) => [id, href])),
    ),
    dockKeyBySection: Object.fromEntries(
      groups.flatMap((group) => group.sectionIds.map((id) => [id, group.dock])),
    ),
  };
}
