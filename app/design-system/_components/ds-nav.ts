export type NavLink = { href: string; label: string };
export type NavGroup = { id: string; title?: string; links: readonly NavLink[] };

const ROOT = '/design-system';

export const DS_NAV_ID = 'ds-nav';
export const DS_SKIP_NAV_LABEL = 'Skip to design system navigation';

export const DS_HOME_LINK: NavLink = { href: '/', label: 'HOME' };

export const DS_NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'pages',
    links: [
      { href: ROOT, label: 'OVERVIEW' },
      { href: `${ROOT}/tokens`, label: 'TOKENS' },
      { href: `${ROOT}/components`, label: 'COMPONENTS' },
      { href: `${ROOT}/enforcement`, label: 'ENFORCEMENT' },
      { href: `${ROOT}/changelog`, label: 'CHANGELOG' },
    ],
  },
  {
    id: 'foundations',
    title: 'FOUNDATIONS',
    links: [
      { href: `${ROOT}/foundations/colors`, label: 'COLORS' },
      { href: `${ROOT}/foundations/typography`, label: 'TYPOGRAPHY' },
      { href: `${ROOT}/foundations/spacing-borders`, label: 'SPACING-BORDERS' },
    ],
  },
  {
    id: 'primitives',
    title: 'PRIMITIVES',
    links: [
      { href: `${ROOT}/primitives/badge`, label: 'BADGE' },
      { href: `${ROOT}/primitives/button`, label: 'BUTTON' },
      { href: `${ROOT}/primitives/cmd-line`, label: 'CMD-LINE' },
      { href: `${ROOT}/primitives/copybutton`, label: 'COPYBUTTON' },
      { href: `${ROOT}/primitives/field`, label: 'FIELD' },
      { href: `${ROOT}/primitives/kbd-key`, label: 'KBD-KEY' },
      { href: `${ROOT}/primitives/stat-tile`, label: 'STAT-TILE' },
      { href: `${ROOT}/primitives/terminal-panel`, label: 'TERMINAL-PANEL' },
      { href: `${ROOT}/primitives/window-chrome`, label: 'WINDOW-CHROME' },
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

export const DS_PAGER: readonly DsPagerPage[] = [
  { slug: '', href: ROOT, label: 'Overview' },
  { slug: 'tokens', href: `${ROOT}/tokens`, label: 'Tokens' },
  { slug: 'components', href: `${ROOT}/components`, label: 'Components' },
  { slug: 'enforcement', href: `${ROOT}/enforcement`, label: 'Enforcement' },
  { slug: 'changelog', href: `${ROOT}/changelog`, label: 'Changelog' },
];

export const DS_PAGER_PREV_LABEL = 'Previous: ';
export const DS_PAGER_NEXT_LABEL = 'Next: ';

export const DS_PAGER_NAV_LABEL = 'Pagination';

export function dsPagerSlugForPathname(pathname: string | null): string | null {
  if (pathname === null) return null;
  if (pathname === ROOT) return '';
  const prefix = `${ROOT}/`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  return DS_PAGER.some((page) => page.slug === rest) ? rest : null;
}
