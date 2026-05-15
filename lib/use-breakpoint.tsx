// lib/use-breakpoint.tsx
'use client';

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { MOBILE_BREAKPOINT_PX } from './breakpoint';

type BreakpointCtx = {
  isMobile: boolean;
  forceDesktop: boolean;
};

const Ctx = createContext<BreakpointCtx | null>(null);

export function BreakpointProvider({
  initialIsMobile,
  forceDesktop = false,
  children,
}: {
  initialIsMobile: boolean;
  /** When true (via ?force=desktop), skip matchMedia so the param persists
   *  after hydration and doesn't get overridden by device width. */
  forceDesktop?: boolean;
  children: ReactNode;
}) {
  const [isMobile, setIsMobile] = useState(initialIsMobile);

  useEffect(() => {
    if (forceDesktop) return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    setIsMobile(mq.matches);
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [forceDesktop]);

  return <Ctx.Provider value={{ isMobile, forceDesktop }}>{children}</Ctx.Provider>;
}

export function useBreakpoint(): BreakpointCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBreakpoint must be used inside <BreakpointProvider>');
  return ctx;
}
