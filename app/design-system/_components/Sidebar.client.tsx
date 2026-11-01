'use client';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DS_DRAWER_CLOSE_LABEL,
  DS_DRAWER_ID,
  DS_DRAWER_LABEL,
  DS_DRAWER_TITLE,
  DS_HOME_LINK,
  DS_MENU_TRIGGER_LABEL,
  DS_NAV_GROUPS,
  DS_NAV_ID,
  DS_SITE_BAR,
  dsPagerSlugForPathname,
} from './ds-nav';
import { Pager } from './Pager';

function isCurrentPage(pathname: string, href: string): boolean {
  return pathname === href;
}

function isCurrentSection(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled])';

type DsNavLinksProps = {
  currentPath: string;
  groupIdPrefix: string;
  onNavigate?: () => void;
};

function DsNavLinks({ currentPath, groupIdPrefix, onNavigate }: DsNavLinksProps) {
  return (
    <>
      <ul className="ds-nav-home">
        <li>
          <a href={DS_HOME_LINK.href} className="ds-nav-item" onClick={onNavigate}>
            {DS_HOME_LINK.label}
          </a>
        </li>
      </ul>
      {DS_NAV_GROUPS.map(({ id, title, links }) => (
        <div key={id} className="contents">
          {title && (
            <p className="ds-nav-group-title" id={`${groupIdPrefix}${id}`}>
              {title}
            </p>
          )}
          <ul
            aria-label={title ? undefined : 'Design system pages'}
            aria-labelledby={title ? `${groupIdPrefix}${id}` : undefined}
          >
            {links.map(({ href, label }) => (
              <li key={href}>
                <a
                  href={href}
                  className="ds-nav-item"
                  aria-current={isCurrentPage(currentPath, href) ? 'page' : undefined}
                  onClick={onNavigate}
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

export function SiteBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const close = useCallback((refocusTrigger: boolean) => {
    setOpen(false);
    if (refocusTrigger) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close(true);
        return;
      }
      if (event.key !== 'Tab' || drawerRef.current === null) return;
      const focusables = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const first = focusables.at(0);
      const last = focusables.at(-1);
      if (first === undefined || last === undefined) return;
      const active = document.activeElement;
      const inside = active instanceof Node && drawerRef.current.contains(active);
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, close]);

  return (
    <>
      <header className="site-bar">
        <div className="site-bar-in">
          <a className="site-bar-brand" href={DS_SITE_BAR.brand.href}>
            {DS_SITE_BAR.brand.label}
          </a>
          <button
            ref={triggerRef}
            type="button"
            className="site-bar-menu"
            aria-expanded={open}
            aria-controls={DS_DRAWER_ID}
            onClick={() => (open ? close(false) : setOpen(true))}
          >
            {DS_MENU_TRIGGER_LABEL}
          </button>
          <nav className="site-bar-nav" aria-label={DS_SITE_BAR.navLabel}>
            {DS_SITE_BAR.links.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                aria-current={isCurrentSection(pathname, href) ? 'page' : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <div
        className={open ? 'site-scrim is-open' : 'site-scrim'}
        onClick={() => close(true)}
        aria-hidden="true"
      />
      <aside
        ref={drawerRef}
        id={DS_DRAWER_ID}
        className={open ? 'site-drawer is-open' : 'site-drawer'}
        aria-label={DS_DRAWER_LABEL}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="site-drawer-head">
          <p className="site-drawer-title">{DS_DRAWER_TITLE}</p>
          <button
            ref={closeRef}
            type="button"
            className="site-drawer-close"
            onClick={() => close(true)}
          >
            {DS_DRAWER_CLOSE_LABEL}
          </button>
        </div>
        <nav className="site-drawer-nav" aria-label={DS_SITE_BAR.navLabel}>
          {DS_SITE_BAR.links.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              aria-current={isCurrentSection(pathname, href) ? 'page' : undefined}
              onClick={() => close(true)}
            >
              {label}
            </a>
          ))}
        </nav>
        <nav className="site-drawer-ds" aria-label="Design system">
          <DsNavLinks
            currentPath={pathname}
            groupIdPrefix="drawer-nav-g-"
            onNavigate={() => close(true)}
          />
        </nav>
      </aside>
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

export function PagerNav() {
  const pathname = usePathname();
  const slug = dsPagerSlugForPathname(pathname);
  if (slug === null) return null;
  return <Pager slug={slug} />;
}
