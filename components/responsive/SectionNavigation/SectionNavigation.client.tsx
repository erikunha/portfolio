'use client';

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
import {
  formatSectionNumber,
  formatSectionPosition,
  HOME_SECTION_ID,
  NAVIGATION,
  sectionHref,
} from '@/content/navigation';
import { SECTION_NAV } from '@/content/section-registry';
import { NavItem } from '@/design-system';
import { cn } from '@/lib/cn';
import { applyMotion, readMotion } from '@/lib/motion';

const MAIN_ID = 'main-content';
export const DRAWER_ID = 'section-drawer';
const MOBILE_HERO_SELECTOR = '[data-testid="hero-mobile"]';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const CURRENT_LINE_MARGIN = '-45% 0px -54% 0px';
const SETTLED_TOP_LIMIT_PX = 150;
const TRAPPED_CONTROLS = 'a[href], button';
const CURRENT_ITEM = '[aria-current]';
const SCROLL_LOCK_ATTRIBUTE = 'data-scroll-locked';
const SEARCH_KEY = 'k';
const INDEX_TRIGGER_CLASS = 'index-trigger';
const INDEX_TRIGGER_SELECTOR = `.${INDEX_TRIGGER_CLASS}`;

type NavigationState = {
  currentId: string;
  drawerOpen: boolean;
  openDrawer: (trigger: HTMLElement) => void;
  closeDrawer: (restoreFocus: boolean) => void;
  settleDrawer: () => void;
  jump: (event: MouseEvent<HTMLElement>, id: string) => void;
  motionOn: boolean;
  toggleMotion: () => void;
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

function isolate(root: HTMLElement): () => void {
  const isolated: Element[] = [];
  for (
    let node: HTMLElement | null = root;
    node && node !== document.body;
    node = node.parentElement
  ) {
    for (const sibling of node.parentElement?.children ?? []) {
      if (sibling !== node && !sibling.hasAttribute('inert')) {
        sibling.setAttribute('inert', '');
        isolated.push(sibling);
      }
    }
  }
  return () => {
    for (const element of isolated) element.removeAttribute('inert');
  };
}

export function SectionNavigationProvider({ children }: { children: ReactNode }) {
  const [currentId, setCurrentId] = useState<string>(HOME_SECTION_ID);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [motionOn, setMotionOn] = useState(true);
  const drawerOpenRef = useRef(false);
  const motionOnRef = useRef(true);
  const triggerRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(true);
  const pendingRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const on = readMotion();
    motionOnRef.current = on;
    setMotionOn(on);
    applyMotion(on);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sections = new Map<Element, string>();
    for (const { id } of SECTION_NAV) {
      const element = document.getElementById(id);
      if (element) sections.set(element, id);
    }
    const mobileHero = document.querySelector(MOBILE_HERO_SELECTOR);
    if (mobileHero) sections.set(mobileHero, HOME_SECTION_ID);
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
  }, []);

  const openDrawer = useCallback((trigger: HTMLElement) => {
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
      ...document.querySelectorAll<HTMLElement>(INDEX_TRIGGER_SELECTOR),
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
      openDrawer(active instanceof HTMLElement ? active : document.body);
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
        toggleMotion,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

const GROUP_SECTIONS = NAVIGATION.groups.map((group) => ({
  group,
  sections: SECTION_NAV.filter(({ id }) => group.sectionIds.some((member) => member === id)),
}));

export function SectionNavigation() {
  const { currentId, drawerOpen, closeDrawer, settleDrawer, jump, motionOn, toggleMotion } =
    useSectionNavigation();
  const { copy } = NAVIGATION;
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
          <span className="menu-badge" data-section-count={SECTION_NAV.length}>
            <span className="sr-only">{`${SECTION_NAV.length} ${copy.sectionCountLabel}`}</span>
            <span aria-hidden="true">{SECTION_NAV.length}</span>
          </span>
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
          {GROUP_SECTIONS.map(({ group, sections }) => {
            const titleId = `menu-group-${group.id}`;
            return (
              <div key={group.id} className="menu-group">
                <span className="menu-group-title" id={titleId}>
                  {group.title}
                </span>
                <ul aria-labelledby={titleId}>
                  {sections.map(({ id, label, order }) => (
                    <li key={id}>
                      <NavItem
                        href={sectionHref(id)}
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
        <ul className="menu-foot">
          {NAVIGATION.siteLinks.map(({ label, index, href, external }) => (
            <li key={href}>
              <NavItem
                href={href}
                label={
                  external ? (
                    <>
                      {label}
                      <span className="sr-only">{copy.newTabSuffix}</span>
                    </>
                  ) : (
                    label
                  )
                }
                index={index}
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
              <span>{motionOn ? copy.motionOn : copy.motionOff}</span>
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

export function IndexTrigger({ className }: { className?: string }) {
  const { currentId, drawerOpen, openDrawer } = useSectionNavigation();
  const { copy } = NAVIGATION;
  return (
    <button
      type="button"
      className={cn(INDEX_TRIGGER_CLASS, className)}
      aria-expanded={drawerOpen}
      aria-controls={DRAWER_ID}
      aria-haspopup="dialog"
      onClick={(event) => openDrawer(event.currentTarget)}
    >
      <span aria-hidden="true">{copy.indexGlyph}</span>
      <span>{copy.indexLabel}</span>
      <span className="index-trigger-pos">{formatSectionPosition(currentId)}</span>
    </button>
  );
}

export function SearchTrigger({ className }: { className?: string }) {
  const { drawerOpen, openDrawer, closeDrawer } = useSectionNavigation();
  const { copy } = NAVIGATION;
  const [shortcut, setShortcut] = useState<string | null>(null);

  useEffect(() => {
    setShortcut(isAppleKeyboard() ? copy.searchShortcutApple : copy.searchShortcutOther);
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
      <span className="search-trigger-shortcut">{shortcut}</span>
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
