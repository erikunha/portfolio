'use client';
import { usePathname } from 'next/navigation';

import { DS_NAV_GROUPS, DS_NAV_ID } from './ds-nav';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav id={DS_NAV_ID} tabIndex={-1} aria-label="Design system" className="ds-sidebar">
      <ul>
        <li>
          <a href="/" className="ds-nav-item">
            ← HOME
          </a>
        </li>
      </ul>
      {DS_NAV_GROUPS.map(({ id, title, links }) => (
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
