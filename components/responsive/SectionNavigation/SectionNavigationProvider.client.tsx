'use client';

import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { NavigationCopy, SiteNavChrome } from '@/content/navigation';
import type { SiteLocale } from '@/content/site-locale';
import { isRendered } from '@/lib/dom/is-rendered';
import { applyMotion, readMotion } from '@/lib/motion';
import { HOME_SECTION_ID, observeSections } from '@/lib/section-spy';
import { MENU_TRIGGER_SELECTOR } from './navigationIds';
import {
  createNavigationStore,
  type NavigationSnapshot,
  type NavigationStore,
} from './navigationStore';
import { jumpTarget, jumpToSection } from './sectionScroll';

const CURRENT_LINE_MARGIN = '-45% 0px -54% 0px';
const INITIAL_SNAPSHOT: NavigationSnapshot = {
  currentId: HOME_SECTION_ID,
  drawerOpen: false,
  motionOn: true,
};

type NavigationState = {
  store: NavigationStore;
  openDrawer: (trigger: HTMLElement | null) => void;
  closeDrawer: (restoreFocus: boolean) => void;
  settleDrawer: () => void;
  jump: (event: MouseEvent<HTMLElement>, id: string) => void;
  toggleMotion: () => void;
  locale: SiteLocale;
  route: string | null;
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

function useNavigationSelector<T>(select: (snapshot: NavigationSnapshot) => T): T {
  const { store } = useSectionNavigation();
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.initial),
  );
}

const selectCurrentId = (snapshot: NavigationSnapshot) => snapshot.currentId;
const selectDrawerOpen = (snapshot: NavigationSnapshot) => snapshot.drawerOpen;
const selectMotionOn = (snapshot: NavigationSnapshot) => snapshot.motionOn;

export const useCurrentSection = () => useNavigationSelector(selectCurrentId);
export const useDrawerOpen = () => useNavigationSelector(selectDrawerOpen);
export const useMotionOn = () => useNavigationSelector(selectMotionOn);

export function useMotionState(): string {
  const { copy } = useSectionNavigation();
  return useNavigationSelector(({ motionOn }) => (motionOn ? copy.motionOn : copy.motionOff));
}

export function SectionNavigationProvider({
  children,
  chrome,
  locale,
  route = null,
}: {
  children?: ReactNode;
  chrome: SiteNavChrome;
  locale: SiteLocale;
  route?: string | null;
}) {
  const [store] = useState(() => createNavigationStore(INITIAL_SNAPSHOT));
  const copy = chrome.navigation.copy;
  const triggerRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(true);
  const pendingRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const on = readMotion();
    store.set({ motionOn: on });
    applyMotion(on, false);
  }, [store]);

  useEffect(() => {
    const sectionIds = chrome.drawerGroups.flatMap((group) => group.sections.map(({ id }) => id));
    return observeSections(sectionIds, { rootMargin: CURRENT_LINE_MARGIN }, ([first]) => {
      if (first !== undefined) store.set({ currentId: first });
    });
  }, [chrome, store]);

  const openDrawer = useCallback(
    (trigger: HTMLElement | null) => {
      triggerRef.current = trigger;
      restoreFocusRef.current = true;
      store.set({ drawerOpen: true });
    },
    [store],
  );

  const closeDrawer = useCallback(
    (restoreFocus: boolean) => {
      restoreFocusRef.current = restoreFocus;
      store.set({ drawerOpen: false });
    },
    [store],
  );

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
      if (store.get().drawerOpen) {
        pendingRef.current = id;
        closeDrawer(false);
      } else {
        jumpToSection(id);
      }
    },
    [closeDrawer, store],
  );

  const toggleMotion = useCallback(() => {
    const next = !store.get().motionOn;
    store.set({ motionOn: next });
    applyMotion(next);
  }, [store]);

  const value = useMemo<NavigationState>(
    () => ({
      store,
      openDrawer,
      closeDrawer,
      settleDrawer,
      jump,
      toggleMotion,
      locale,
      route,
      copy,
      chrome,
    }),
    [store, openDrawer, closeDrawer, settleDrawer, jump, toggleMotion, locale, route, copy, chrome],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}
