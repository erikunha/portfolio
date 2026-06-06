'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useSyncExternalStore,
} from 'react';
import { MOBILE_BREAKPOINT_PX } from './breakpoint';

type BreakpointCtx = {
  isMobile: boolean;
};

const Ctx = createContext<BreakpointCtx | null>(null);

export function BreakpointProvider({
  initialIsMobile,
  children,
}: {
  initialIsMobile: boolean;
  children: ReactNode;
}) {
  const mqRef = useRef<MediaQueryList | null>(null);
  if (!mqRef.current && typeof window !== 'undefined') {
    mqRef.current = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
  }

  // subscribe must be stable — mqRef never changes after first mount
  const subscribe = useCallback(
    (cb: () => void) => {
      mqRef.current?.addEventListener('change', cb);
      return () => mqRef.current?.removeEventListener('change', cb);
    },
    // mqRef is a stable useRef, never recreated — empty deps is intentional
    [],
  );

  const isMobileFromMedia = useSyncExternalStore(
    subscribe,
    () => mqRef.current?.matches ?? initialIsMobile,
    () => initialIsMobile,
  );

  return <Ctx.Provider value={{ isMobile: isMobileFromMedia }}>{children}</Ctx.Provider>;
}

export function useBreakpoint(): BreakpointCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBreakpoint must be used inside <BreakpointProvider>');
  return ctx;
}
