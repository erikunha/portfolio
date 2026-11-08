'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { externalLinkProps } from '@/components/ExternalLink';
import { StatusDot } from '@/components/StatusDot';
import { MOTION_STATE_SEPARATOR, TOPBAR_MOTION_LABEL } from '@/content/nav';
import { NavItem } from '@/design-system';
import { cn } from '@/lib/cn';
import { isolate } from '@/lib/dom/isolate';
import { DRAWER_ID } from './navigationIds';
import {
  useCurrentSection,
  useDrawerOpen,
  useMotionOn,
  useMotionState,
  useSectionNavigation,
} from './SectionNavigationProvider.client';

const POSITION_DIGITS = 2;
const formatSectionNumber = (order: number) => String(order).padStart(POSITION_DIGITS, '0');
const TRAPPED_CONTROLS = 'a[href], button';
const CURRENT_ITEM = '[aria-current]';
const SCROLL_LOCK_ATTRIBUTE = 'data-scroll-locked';

export function SectionNavigation({ extra }: { extra?: ReactNode }) {
  const { closeDrawer, settleDrawer, jump, toggleMotion, copy, chrome } = useSectionNavigation();
  const currentId = useCurrentSection();
  const drawerOpen = useDrawerOpen();
  const motionOn = useMotionOn();
  const motionState = useMotionState();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawerOpen || !rootRef.current) return;
    const release = isolate(rootRef.current);
    document.documentElement.setAttribute(SCROLL_LOCK_ATTRIBUTE, '');
    const current = panelRef.current?.querySelector<HTMLElement>(CURRENT_ITEM);
    (current ?? closeRef.current)?.focus();
    return () => {
      release();
      document.documentElement.removeAttribute(SCROLL_LOCK_ATTRIBUTE);
      settleDrawer();
    };
  }, [drawerOpen, settleDrawer]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (event.key === 'Escape') {
        closeDrawer(true);
      } else if (event.key === 'Tab') {
        const controls = panel.querySelectorAll<HTMLElement>(TRAPPED_CONTROLS);
        const first = controls[0];
        const last = controls[controls.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, closeDrawer]);

  return (
    <div ref={rootRef} className="section-nav-root">
      <aside
        ref={panelRef}
        id={DRAWER_ID}
        className={cn('section-menu', drawerOpen && 'is-open')}
        aria-label={copy.drawerLabel}
        {...(drawerOpen ? { role: 'dialog', 'aria-modal': true } : {})}
      >
        <div className="menu-head">
          <span className="menu-title">{copy.title}</span>
          <button
            ref={closeRef}
            type="button"
            className="menu-close"
            onClick={() => closeDrawer(true)}
          >
            {copy.closeDrawer}
          </button>
        </div>
        <nav id="section-nav" aria-label={copy.navLabel}>
          {chrome.drawerGroups.map((group) => {
            const titleId = `menu-group-${group.id}`;
            return (
              <div key={group.id} className="menu-group">
                <span className="menu-group-title" id={titleId}>
                  {group.title}
                </span>
                <ul aria-labelledby={titleId}>
                  {group.sections.map(({ id, label, order, href }) => (
                    <li key={id}>
                      <NavItem
                        href={href}
                        label={label}
                        index={formatSectionNumber(order)}
                        current={id === currentId}
                        onClick={(event) => jump(event, id)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
        {extra ? <div className="menu-extra">{extra}</div> : null}
        <ul className="menu-foot">
          {chrome.navigation.siteLinks.map(({ label, index, href, external, accessibleName }) => (
            <li key={href}>
              <NavItem
                href={href}
                label={label}
                index={index}
                aria-label={accessibleName}
                {...externalLinkProps(external)}
              />
            </li>
          ))}
          <li>
            <button
              type="button"
              className="menu-motion"
              data-motion-toggle=""
              aria-pressed={motionOn}
              onClick={toggleMotion}
            >
              <StatusDot blink />
              <span>{TOPBAR_MOTION_LABEL}</span>
              <span aria-hidden="true">
                {MOTION_STATE_SEPARATOR}
                <span data-motion-state="">{motionState}</span>
              </span>
            </button>
          </li>
        </ul>
      </aside>
      <div
        className={cn('menu-scrim', drawerOpen && 'is-open')}
        aria-hidden="true"
        onClick={() => closeDrawer(true)}
      />
    </div>
  );
}
