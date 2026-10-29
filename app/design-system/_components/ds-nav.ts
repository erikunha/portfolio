export type NavLink = { href: string; label: string };
export type NavGroup = { id: string; title?: string; links: readonly NavLink[] };

const ROOT = '/design-system';

export const DS_NAV_ID = 'ds-nav';
export const DS_NAV_SKIP_LABEL = 'Skip to design-system navigation';

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
