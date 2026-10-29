'use client';

import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  formatSectionNumber,
  HOME_SECTION_ID,
  NAVIGATION,
  sectionHref,
} from '@/content/navigation';
import { SECTION_NAV } from '@/content/section-registry';
import { NavItem } from '@/design-system';
import { cn } from '@/lib/cn';

const MAIN_ID = 'main-content';
const DRAWER_ID = 'section-drawer';
const MOBILE_HERO_SELECTOR = '[data-testid="hero-mobile"]';
const DRAWER_QUERY = '(max-width: 1023px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const CURRENT_LINE_MARGIN = '-45% 0px -54% 0px';
const SETTLED_TOP_LIMIT_PX = 150;
const TRAPPED_CONTROLS = 'a[href], button:not([data-rail-only])';
const SCROLL_LOCK_ATTRIBUTE = 'data-scroll-locked';

type NavigationState = {
  currentId: string;
  drawerOpen: boolean;
  openDrawer: (trigger: HTMLElement) => void;
  closeDrawer: (restoreFocus: boolean) => void;
  settleDrawer: () => void;
  jump: (event: MouseEvent<HTMLElement>, id: string) => void;
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
  const drawerOpenRef = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(true);
  const pendingRef = useRef<string | null>(null);

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
    if (pending) jumpToSection(pending);
    else if (restoreFocusRef.current) triggerRef.current?.focus();
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

  return (
    <NavigationContext.Provider
      value={{ currentId, drawerOpen, openDrawer, closeDrawer, settleDrawer, jump }}
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
  const { currentId, drawerOpen, closeDrawer, settleDrawer, jump } = useSectionNavigation();
  const { copy } = NAVIGATION;
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [railExpanded, setRailExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!drawerOpen || !rootRef.current) return;
    const release = isolate(rootRef.current);
    document.documentElement.setAttribute(SCROLL_LOCK_ATTRIBUTE, '');
    closeRef.current?.focus();
    const viewport = window.matchMedia(DRAWER_QUERY);
    const onViewport = (event: { matches: boolean }) => {
      if (!event.matches) closeDrawer(false);
    };
    viewport.addEventListener('change', onViewport);
    return () => {
      viewport.removeEventListener('change', onViewport);
      release();
      document.documentElement.removeAttribute(SCROLL_LOCK_ATTRIBUTE);
      settleDrawer();
    };
  }, [drawerOpen, closeDrawer, settleDrawer]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (event.key === 'Escape') {
        if (drawerOpen) {
          closeDrawer(true);
        } else if (railExpanded || panel.contains(document.activeElement)) {
          const focusInside = panel.contains(document.activeElement);
          setRailExpanded(false);
          setDismissed(true);
          if (focusInside) toggleRef.current?.focus();
        }
      } else if (event.key === 'Tab' && drawerOpen) {
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
  }, [drawerOpen, railExpanded, closeDrawer]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const reopen = () => setDismissed(false);
    const onFocusIn = (event: FocusEvent) => {
      if ((event.target as HTMLElement).closest('a.nav-item')) reopen();
    };
    panel.addEventListener('mouseenter', reopen);
    panel.addEventListener('focusin', onFocusIn);
    return () => {
      panel.removeEventListener('mouseenter', reopen);
      panel.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  useEffect(() => {
    if (!railExpanded) return;
    const onClick = (event: Event) => {
      if (!panelRef.current?.contains(event.target as Node)) setRailExpanded(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [railExpanded]);

  return (
    <div ref={rootRef} className="section-nav-root">
      <aside
        ref={panelRef}
        id={DRAWER_ID}
        className={cn(
          'section-menu',
          drawerOpen && 'is-open',
          railExpanded && 'is-expanded',
          dismissed && 'is-dismissed',
        )}
        aria-label={copy.drawerLabel}
        {...(drawerOpen ? { role: 'dialog', 'aria-modal': true } : {})}
      >
        <div className="menu-head">
          <span className="menu-title">{copy.title}</span>
          <span className="menu-end">
            <button
              ref={toggleRef}
              type="button"
              className="rail-toggle"
              data-rail-only=""
              aria-label={copy.openRail}
              aria-expanded={railExpanded}
              aria-controls={DRAWER_ID}
              onClick={() => setRailExpanded((expanded) => !expanded)}
            >
              ☰
            </button>
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
        <nav id="section-nav" aria-label={copy.navLabel}>
          {GROUP_SECTIONS.map(({ group, sections }) => {
            const titleId = `menu-group-${group.id}`;
            return (
              <div key={group.id} className="menu-group">
                <hr className="rail-sep" />
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
                        onClick={(event) => {
                          setRailExpanded(false);
                          jump(event, id);
                        }}
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
