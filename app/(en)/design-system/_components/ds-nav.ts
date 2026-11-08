export type NavLink = { href: string; label: string };
export type NavGroup = { id: string; title?: string; links: readonly NavLink[] };

export const DS_ROOT_PATH = '/design-system';

export const DS_NAV_ID = 'ds-nav';
export const DS_SKIP_NAV_LABEL = 'Skip to design system navigation';

export const DS_HOME_LINK: NavLink = { href: '/', label: 'HOME' };

export const DS_NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'pages',
    links: [
      { href: DS_ROOT_PATH, label: 'OVERVIEW' },
      { href: `${DS_ROOT_PATH}/tokens`, label: 'TOKENS' },
      { href: `${DS_ROOT_PATH}/components`, label: 'COMPONENTS' },
      { href: `${DS_ROOT_PATH}/enforcement`, label: 'ENFORCEMENT' },
      { href: `${DS_ROOT_PATH}/changelog`, label: 'CHANGELOG' },
    ],
  },
  {
    id: 'foundations',
    title: 'FOUNDATIONS',
    links: [
      { href: `${DS_ROOT_PATH}/foundations/colors`, label: 'COLORS' },
      { href: `${DS_ROOT_PATH}/foundations/typography`, label: 'TYPOGRAPHY' },
      { href: `${DS_ROOT_PATH}/foundations/spacing-borders`, label: 'SPACING-BORDERS' },
    ],
  },
  {
    id: 'primitives',
    title: 'PRIMITIVES',
    links: [
      { href: `${DS_ROOT_PATH}/primitives/badge`, label: 'BADGE' },
      { href: `${DS_ROOT_PATH}/primitives/brand-icon`, label: 'BRAND-ICON' },
      { href: `${DS_ROOT_PATH}/primitives/button`, label: 'BUTTON' },
      { href: `${DS_ROOT_PATH}/primitives/cmd-line`, label: 'CMD-LINE' },
      { href: `${DS_ROOT_PATH}/primitives/copybutton`, label: 'COPYBUTTON' },
      { href: `${DS_ROOT_PATH}/primitives/field`, label: 'FIELD' },
      { href: `${DS_ROOT_PATH}/primitives/kbd-key`, label: 'KBD-KEY' },
      { href: `${DS_ROOT_PATH}/primitives/stat-tile`, label: 'STAT-TILE' },
      { href: `${DS_ROOT_PATH}/primitives/terminal-panel`, label: 'TERMINAL-PANEL' },
      { href: `${DS_ROOT_PATH}/primitives/window-chrome`, label: 'WINDOW-CHROME' },
    ],
  },
];

export const DS_ROUTES: readonly string[] = DS_NAV_GROUPS.flatMap((group) =>
  group.links.map((link) => link.href),
);

export const DS_DRAWER_NAV_LABEL = 'Design system menu';
export const DS_NOSCRIPT_NAV_LABEL = 'Design system pages without scripting';

export const DS_PAGES_LIST_LABEL = 'Design system pages';

export type DsPagerPage = { slug: string; href: string; label: string };

const PAGER_GROUP_ID = 'pages';

function titleCase(label: string): string {
  return `${label.charAt(0)}${label.slice(1).toLowerCase()}`;
}

export const DS_PAGER: readonly DsPagerPage[] = (
  DS_NAV_GROUPS.find((group) => group.id === PAGER_GROUP_ID)?.links ?? []
).map(({ href, label }) => ({
  slug: href === DS_ROOT_PATH ? '' : href.slice(`${DS_ROOT_PATH}/`.length),
  href,
  label: titleCase(label),
}));

export const DS_PAGER_PREV_LABEL = 'Previous: ';
export const DS_PAGER_NEXT_LABEL = 'Next: ';

export const DS_PAGER_NAV_LABEL = 'Pagination';

export function dsPagerSlugForPathname(pathname: string | null): string | null {
  if (pathname === null) return null;
  if (pathname === DS_ROOT_PATH) return '';
  const prefix = `${DS_ROOT_PATH}/`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  return DS_PAGER.some((page) => page.slug === rest) ? rest : null;
}
