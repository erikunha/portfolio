'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
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
  LANGUAGE_SWITCH_NAME,
  languageSwitchPaths,
  SITE_LOCALES,
  type SiteLocale,
} from '@/content/site-locale';
import { NavItem } from '@/design-system';
import { cn } from '@/lib/cn';
import { isolate } from '@/lib/dom/isolate';
import { applyMotion, readMotion, readSystemReducedMotion } from '@/lib/motion';

const MAIN_ID = 'main-content';
// The hero section id is structural (the first registry destination); keeping
// the literal here avoids importing the bilingual navigation module runtime.
const HOME_SECTION_ID = 'bio';
const POSITION_DIGITS = 2;
const formatSectionNumber = (order: number) => String(order).padStart(POSITION_DIGITS, '0');
export const DRAWER_ID = 'section-drawer';
const MOBILE_HERO_SELECTOR = '[data-testid="hero-mobile"]';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const CURRENT_LINE_MARGIN = '-45% 0px -54% 0px';
const SETTLED_TOP_LIMIT_PX = 150;
const TRAPPED_CONTROLS = 'a[href], button';
const CURRENT_ITEM = '[aria-current]';
const SCROLL_LOCK_ATTRIBUTE = 'data-scroll-locked';
const SEARCH_KEY = 'k';
const NO_CURRENT_SECTION = '';
const MENU_TRIGGER_CLASS = 'menu-trigger';
const MENU_TRIGGER_SELECTOR = `.${MENU_TRIGGER_CLASS}`;
export const MENU_ICON_PATH = 'M4 7h16M4 12h16M4 17h16';
const ICON_VIEWBOX = '0 0 24 24';
const KEYBOARD_PLATFORM = {
  APPLE: 'apple',
  OTHER: 'other',
} as const;

type KeyboardPlatform = (typeof KEYBOARD_PLATFORM)[keyof typeof KEYBOARD_PLATFORM];

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
  const reduced = window.matchMedia(REDUCED_MOTION_QUERY).matches;
  return reduced || document.body.dataset.motion === 'reduce' ? 'auto' : 'smooth';
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
    pendingCorrection = new AbortController();
    window.addEventListener(
      'scrollend',
      () => {
        const { top } = target.getBoundingClientRect();
        if (top < 0 || top > SETTLED_TOP_LIMIT_PX) target.scrollIntoView({ block: 'start' });
      },
      { once: true, signal: pendingCorrection.signal },
    );
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.shiftKey) return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.key.toLowerCase() !== SEARCH_KEY) return;
      if (drawerOpenRef.current) return;
      event.preventDefault();
      const active = document.activeElement;
      const opener = active instanceof HTMLElement && active !== document.body ? active : null;
      openDrawer(opener);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openDrawer]);

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

// Language switch (DECISIONS 2026-08-30, extending the /links decision to the
// site): links carrying hrefLang + aria-current, never a toggle. Renders only
// where the current address exists in both languages.
function LanguageSwitch({ locale, copy }: { locale: SiteLocale; copy: NavigationCopy }) {
  const pathname = usePathname();
  const paths = pathname ? languageSwitchPaths(pathname) : null;
  if (!paths) return null;
  return (
    <li>
      <nav aria-label={copy.langSwitchLabel} className="menu-lang" data-lang-switch="">
        {SITE_LOCALES.map((candidate) => {
          const href = paths[candidate];
          if (!href) return null;
          return (
            <a
              key={candidate}
              href={href}
              hrefLang={candidate}
              {...(candidate === locale ? { 'aria-current': 'page' as const } : {})}
            >
              {candidate.toUpperCase()}
              <span className="sr-only">&nbsp;{LANGUAGE_SWITCH_NAME[candidate]}</span>
            </a>
          );
        })}
      </nav>
    </li>
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
    locale,
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
        <SearchTrigger className="menu-search" />
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
          <LanguageSwitch locale={locale} copy={copy} />
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

export function SearchTrigger({ className }: { className?: string }) {
  const { drawerOpen, openDrawer, closeDrawer, copy } = useSectionNavigation();
  const [keyboard, setKeyboard] = useState<KeyboardPlatform>(KEYBOARD_PLATFORM.APPLE);

  useEffect(() => {
    if (!isAppleKeyboard()) setKeyboard(KEYBOARD_PLATFORM.OTHER);
  }, []);

  return (
    <button
      type="button"
      className={cn('search-trigger', className)}
      aria-expanded={drawerOpen}
      aria-controls={DRAWER_ID}
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      onClick={(event) => {
        if (drawerOpen) closeDrawer(true);
        else openDrawer(event.currentTarget);
      }}
    >
      <span className="search-trigger-label">{copy.searchLabel}</span>
      <span className="search-trigger-shortcut" data-keyboard={keyboard}>
        <span data-platform={KEYBOARD_PLATFORM.APPLE}>{copy.searchShortcutApple}</span>
        <span data-platform={KEYBOARD_PLATFORM.OTHER}>{copy.searchShortcutOther}</span>
      </span>
    </button>
  );
}

type PlatformNavigator = Navigator & { userAgentData?: { platform?: string } };

function isAppleKeyboard(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform =
    (navigator as PlatformNavigator).userAgentData?.platform ?? navigator.platform ?? '';
  return /mac/i.test(platform);
}
