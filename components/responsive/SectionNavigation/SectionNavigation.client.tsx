'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  Fragment,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { NavigationCopy, SiteNavChrome } from '@/content/navigation';
import {
  headerLanguageSwitchPaths,
  LANGUAGE_SWITCH_NAME,
  SITE_LOCALES,
  type SiteLocale,
} from '@/content/site-locale';
import { NavItem } from '@/design-system';
import { cn } from '@/lib/cn';
import { isolate } from '@/lib/dom/isolate';
import { applyMotion, motionInEffect, readMotion, readSystemReducedMotion } from '@/lib/motion';

const MAIN_ID = 'main-content';
const HOME_SECTION_ID = 'bio';
const POSITION_DIGITS = 2;
const formatSectionNumber = (order: number) => String(order).padStart(POSITION_DIGITS, '0');
export const DRAWER_ID = 'section-drawer';
const MOBILE_HERO_SELECTOR = '[data-testid="hero-mobile"]';
const CURRENT_LINE_MARGIN = '-45% 0px -54% 0px';
const SETTLED_TOP_LIMIT_PX = 150;
const PENDING_CORRECTION_TIMEOUT_MS = 3000;
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
const TRAPPED_CONTROLS = 'a[href], button';
const CURRENT_ITEM = '[aria-current]';
const SCROLL_LOCK_ATTRIBUTE = 'data-scroll-locked';
const NO_CURRENT_SECTION = '';
const MENU_TRIGGER_CLASS = 'menu-trigger';
const MENU_TRIGGER_SELECTOR = `.${MENU_TRIGGER_CLASS}`;
export const MENU_ICON_PATH = 'M4 7h16M4 12h16M4 17h16';
const ICON_VIEWBOX = '0 0 24 24';
const LANGUAGE_SEPARATOR = '\u00b7';
type NavigationState = {
  currentId: string;
  drawerOpen: boolean;
  openDrawer: (trigger: HTMLElement | null) => void;
  closeDrawer: (restoreFocus: boolean) => void;
  settleDrawer: () => void;
  jump: (event: MouseEvent<HTMLElement>, id: string) => void;
  motionOn: boolean;
  motionLabel: string;
  toggleMotion: () => void;
  locale: SiteLocale;
  copy: NavigationCopy;
  chrome: SiteNavChrome;
};

const NavigationContext = createContext<NavigationState | null>(null);

export function useSectionNavigation(): NavigationState {
  const state = useContext(NavigationContext);
  if (!state)
    throw new Error('useSectionNavigation must be used inside <SectionNavigationProvider>');
  return state;
}

function scrollBehavior(): ScrollBehavior {
  return motionInEffect() ? 'smooth' : 'auto';
}

function jumpTarget(id: string): HTMLElement | null {
  return document.getElementById(id === HOME_SECTION_ID ? MAIN_ID : id);
}

let pendingCorrection: AbortController | null = null;

export function jumpToSection(id: string): boolean {
  const target = jumpTarget(id);
  if (!target) return false;
  pendingCorrection?.abort();
  pendingCorrection = null;
  const behavior = scrollBehavior();
  if (id === HOME_SECTION_ID) window.scrollTo({ top: 0, behavior });
  else {
    target.scrollIntoView({ behavior, block: 'start' });
    const correction = new AbortController();
    pendingCorrection = correction;
    const { signal } = correction;
    const cancel = () => correction.abort();
    window.addEventListener(
      'scrollend',
      () => {
        cancel();
        const { top } = target.getBoundingClientRect();
        if (top < 0 || top > SETTLED_TOP_LIMIT_PX) target.scrollIntoView({ block: 'start' });
      },
      { once: true, signal },
    );
    for (const type of USER_SCROLL_EVENTS) {
      window.addEventListener(type, cancel, { once: true, passive: true, signal });
    }
    const timeout = window.setTimeout(cancel, PENDING_CORRECTION_TIMEOUT_MS);
    signal.addEventListener('abort', () => window.clearTimeout(timeout), { once: true });
  }
  target.focus({ preventScroll: true });
  return true;
}

function isRendered(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  if (element.hasAttribute('inert')) return false;
  if (element.hidden) return false;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

export function SectionNavigationProvider({
  children,
  chrome,
  locale,
}: {
  children?: ReactNode;
  chrome: SiteNavChrome;
  locale: SiteLocale;
}) {
  const [currentId, setCurrentId] = useState<string>(HOME_SECTION_ID);
  const copy = chrome.navigation.copy;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [motionOn, setMotionOn] = useState(true);
  const [systemReduced, setSystemReduced] = useState(false);
  const drawerOpenRef = useRef(false);
  const motionOnRef = useRef(true);
  const triggerRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(true);
  const pendingRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const on = readMotion();
    motionOnRef.current = on;
    setMotionOn(on);
    setSystemReduced(readSystemReducedMotion());
    applyMotion(on, false);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sections = new Map<Element, string>();
    const sectionIds = chrome.drawerGroups.flatMap((group) => group.sections.map(({ id }) => id));
    for (const id of sectionIds) {
      const element = document.getElementById(id);
      if (element) sections.set(element, id);
    }
    const mobileHero = document.querySelector(MOBILE_HERO_SELECTOR);
    if (mobileHero) sections.set(mobileHero, HOME_SECTION_ID);
    if (sections.size === 0) {
      setCurrentId(NO_CURRENT_SECTION);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        let first: Element | undefined;
        for (const { target, isIntersecting } of entries) {
          if (!isIntersecting) continue;
          if (!first || first.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_PRECEDING)
            first = target;
        }
        const id = first && sections.get(first);
        if (id) setCurrentId(id);
      },
      { rootMargin: CURRENT_LINE_MARGIN },
    );
    for (const element of sections.keys()) observer.observe(element);
    return () => observer.disconnect();
  }, [chrome]);

  const openDrawer = useCallback((trigger: HTMLElement | null) => {
    triggerRef.current = trigger;
    restoreFocusRef.current = true;
    drawerOpenRef.current = true;
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback((restoreFocus: boolean) => {
    restoreFocusRef.current = restoreFocus;
    drawerOpenRef.current = false;
    setDrawerOpen(false);
  }, []);

  const settleDrawer = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) {
      jumpToSection(pending);
      return;
    }
    if (!restoreFocusRef.current) return;
    const candidates = [
      triggerRef.current,
      ...document.querySelectorAll<HTMLElement>(MENU_TRIGGER_SELECTOR),
    ];
    for (const candidate of candidates) {
      if (!candidate || !isRendered(candidate)) continue;
      candidate.focus();
      return;
    }
  }, []);

  const jump = useCallback(
    (event: MouseEvent<HTMLElement>, id: string) => {
      const { defaultPrevented, button, metaKey, ctrlKey, shiftKey, altKey } = event;
      if (defaultPrevented || button || metaKey || ctrlKey || shiftKey || altKey) return;
      if (!jumpTarget(id)) return;
      event.preventDefault();
      if (drawerOpenRef.current) {
        pendingRef.current = id;
        closeDrawer(false);
      } else {
        jumpToSection(id);
      }
    },
    [closeDrawer],
  );

  const toggleMotion = useCallback(() => {
    const next = !motionOnRef.current;
    motionOnRef.current = next;
    setMotionOn(next);
    applyMotion(next);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        currentId,
        drawerOpen,
        openDrawer,
        closeDrawer,
        settleDrawer,
        jump,
        motionOn,
        motionLabel: motionOn ? copy.motionOn : systemReduced ? copy.motionReduced : copy.motionOff,
        toggleMotion,
        locale,
        copy,
        chrome,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, copy } = useSectionNavigation();
  const pathname = usePathname();
  const paths = pathname ? headerLanguageSwitchPaths(pathname) : null;
  if (!paths) return null;
  return (
    <nav
      aria-label={copy.langSwitchLabel}
      className={cn('lang-switch', className)}
      data-lang-switch=""
    >
      {SITE_LOCALES.map((candidate, position) => (
        <Fragment key={candidate}>
          {position > 0 ? (
            <span className="lang-switch-sep" aria-hidden="true">
              {LANGUAGE_SEPARATOR}
            </span>
          ) : null}
          <a
            href={paths[candidate]}
            hrefLang={candidate}
            {...(candidate === locale ? { 'aria-current': 'page' as const } : {})}
          >
            {candidate.toUpperCase()}
            <span className="sr-only">&nbsp;{LANGUAGE_SWITCH_NAME[candidate]}</span>
          </a>
        </Fragment>
      ))}
    </nav>
  );
}

export function SectionNavigation({ extra }: { extra?: ReactNode }) {
  const {
    currentId,
    drawerOpen,
    closeDrawer,
    settleDrawer,
    jump,
    motionOn,
    motionLabel,
    toggleMotion,
    copy,
    chrome,
  } = useSectionNavigation();
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
                {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
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
              <span className="menu-motion-dot" aria-hidden="true" />
              <span>{motionLabel}</span>
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

export function MenuTrigger({ className }: { className?: string }) {
  const { drawerOpen, openDrawer, copy } = useSectionNavigation();
  return (
    <button
      type="button"
      className={cn(MENU_TRIGGER_CLASS, className)}
      aria-label={copy.openMenu}
      aria-expanded={drawerOpen}
      aria-controls={DRAWER_ID}
      aria-haspopup="dialog"
      onClick={(event) => openDrawer(event.currentTarget)}
    >
      <svg viewBox={ICON_VIEWBOX} aria-hidden="true" focusable="false">
        <path d={MENU_ICON_PATH} />
      </svg>
    </button>
  );
}
