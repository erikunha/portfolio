'use client';
import { usePathname } from 'next/navigation';
import {
  DS_DRAWER_NAV_LABEL,
  DS_HOME_LINK,
  DS_NAV_GROUPS,
  DS_NAV_ID,
  DS_NOSCRIPT_NAV_LABEL,
  DS_PAGES_LIST_LABEL,
  dsPagerSlugForPathname,
} from './ds-nav';
import { Pager } from './Pager';

function isCurrentPage(pathname: string, href: string): boolean {
  return pathname === href;
}

type DsNavLinksProps = {
  currentPath: string;
  groupIdPrefix: string;
  withHome?: boolean;
};

function DsNavLinks({ currentPath, groupIdPrefix, withHome = true }: DsNavLinksProps) {
  return (
    <>
      {withHome ? (
        <ul className="ds-nav-home">
          <li>
            <a href={DS_HOME_LINK.href} className="ds-nav-item">
              {DS_HOME_LINK.label}
            </a>
          </li>
        </ul>
      ) : null}
      {DS_NAV_GROUPS.map(({ id, title, links }) => (
        <div key={id} className="contents">
          {title && (
            <p className="ds-nav-group-title" id={`${groupIdPrefix}${id}`}>
              {title}
            </p>
          )}
          <ul
            aria-label={title ? undefined : DS_PAGES_LIST_LABEL}
            aria-labelledby={title ? `${groupIdPrefix}${id}` : undefined}
          >
            {links.map(({ href, label }) => (
              <li key={href}>
                <a
                  href={href}
                  className="ds-nav-item"
                  aria-current={isCurrentPage(currentPath, href) ? 'page' : undefined}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav id={DS_NAV_ID} tabIndex={-1} aria-label="Design system" className="ds-sidebar">
      <DsNavLinks currentPath={pathname} groupIdPrefix="nav-g-" />
    </nav>
  );
}

export function DsDrawerNav() {
  const pathname = usePathname();

  return (
    <nav aria-label={DS_DRAWER_NAV_LABEL} className="ds-drawer-nav">
      <DsNavLinks currentPath={pathname} groupIdPrefix="drawer-nav-g-" withHome={false} />
    </nav>
  );
}

export function DsNavNoScript() {
  const pathname = usePathname();

  return (
    <noscript>
      <nav aria-label={DS_NOSCRIPT_NAV_LABEL} className="ds-sidebar ds-sidebar-nojs">
        <DsNavLinks currentPath={pathname} groupIdPrefix="nojs-nav-g-" />
      </nav>
    </noscript>
  );
}

export function PagerNav() {
  const pathname = usePathname();
  const slug = dsPagerSlugForPathname(pathname);
  if (slug === null) return null;
  return <Pager slug={slug} />;
}
