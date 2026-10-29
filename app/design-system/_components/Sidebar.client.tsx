'use client';
import { usePathname } from 'next/navigation';

type NavLink = { href: string; label: string };
type NavGroup = { id: string; title?: string; links: readonly NavLink[] };

const ROOT = '/design-system';

const GROUPS: readonly NavGroup[] = [
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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Design system" className="ds-sidebar">
      <ul>
        <li>
          <a href="/" className="ds-nav-item">
            ← HOME
          </a>
        </li>
      </ul>
      {GROUPS.map(({ id, title, links }) => (
        <div key={id} className="contents">
          {title && (
            <p className="ds-nav-group-title" id={`nav-g-${id}`}>
              {title}
            </p>
          )}
          <ul
            aria-label={title ? undefined : 'Design system pages'}
            aria-labelledby={title ? `nav-g-${id}` : undefined}
          >
            {links.map(({ href, label }) => (
              <li key={href}>
                <a
                  href={href}
                  className="ds-nav-item"
                  aria-current={pathname === href ? 'page' : undefined}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
