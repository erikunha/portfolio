'use client';

import { type MouseEvent, type ReactNode, type SyntheticEvent, useEffect, useRef } from 'react';
import { externalLinkProps } from '@/components/ExternalLink';
import { StatusDot } from '@/components/StatusDot';
import { MOTION_STATE_SEPARATOR, TOPBAR_MOTION_LABEL } from '@/content/nav';
import { NavItem } from '@/design-system';
import { longestTransitionMs } from '@/lib/dom/longest-transition-ms';
import { joinClassNames } from '@/lib/join-class-names';
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
const EXIT_PROPERTY = 'transform';
const EXITING_ATTRIBUTE = 'data-exiting';
const EXIT_FALLBACK_SLACK_MS = 50;
const NO_ELAPSED_TIME = 0;

export function SectionNavigation({ extra }: { extra?: ReactNode }) {
  const { store, closeDrawer, settleDrawer, jump, toggleMotion, copy, chrome } =
    useSectionNavigation();
  const currentId = useCurrentSection();
  const drawerOpen = useDrawerOpen();
  const motionOn = useMotionOn();
  const motionState = useMotionState();
  const panelRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const settleExitRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!drawerOpen || !panel) return;
    settleExitRef.current?.();
    panel.showModal();
    document.documentElement.setAttribute(SCROLL_LOCK_ATTRIBUTE, '');
    const current = panel.querySelector<HTMLElement>(CURRENT_ITEM);
    (current ?? closeRef.current)?.focus();
    return () => {
      const slideMs = panel.open ? longestTransitionMs(panel) : 0;
      document.documentElement.removeAttribute(SCROLL_LOCK_ATTRIBUTE);
      if (slideMs === 0) {
        panel.close();
        settleDrawer();
        return;
      }
      panel.setAttribute(EXITING_ATTRIBUTE, '');
      panel.close();
      panel.inert = true;
      panel.show();
      settleDrawer();
      const onTransitionEnd = (event: TransitionEvent) => {
        if (event.target !== panel || event.propertyName !== EXIT_PROPERTY) return;
        if (event.elapsedTime !== NO_ELAPSED_TIME) done();
      };
      const timer = setTimeout(() => done(), slideMs + EXIT_FALLBACK_SLACK_MS);
      const done = () => {
        clearTimeout(timer);
        panel.removeEventListener('transitionend', onTransitionEnd);
        settleExitRef.current = null;
        panel.removeAttribute(EXITING_ATTRIBUTE);
        panel.inert = false;
        panel.close();
      };
      panel.addEventListener('transitionend', onTransitionEnd);
      settleExitRef.current = done;
    };
  }, [drawerOpen, settleDrawer]);

  useEffect(() => () => settleExitRef.current?.(), []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel || event.key !== 'Tab') return;
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
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    closeDrawer(true);
  };

  const onClose = (event: SyntheticEvent<HTMLDialogElement>) => {
    if (!event.currentTarget.open && store.get().drawerOpen) closeDrawer(true);
  };

  const onPanelClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) closeDrawer(true);
  };

  return (
    <div className="section-nav-root">
      <dialog
        ref={panelRef}
        id={DRAWER_ID}
        className={joinClassNames('section-menu', drawerOpen && 'is-open')}
        aria-label={copy.drawerLabel}
        onCancel={onCancel}
        onClose={onClose}
        onClick={onPanelClick}
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
        <div className="menu-controls">
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
        </ul>
      </dialog>
      <div className={joinClassNames('menu-scrim', drawerOpen && 'is-open')} aria-hidden="true" />
    </div>
  );
}
