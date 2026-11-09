'use client';

import { useSyncExternalStore } from 'react';
import { isMobileViewport, watchMobileViewport } from './media-queries';

type Breakpoint = {
  isMobile: boolean;
};

const subscribe = (onChange: () => void) => watchMobileViewport(onChange);

const readMobileOnServer = () => false;

export function useBreakpoint(): Breakpoint {
  return { isMobile: useSyncExternalStore(subscribe, isMobileViewport, readMobileOnServer) };
}
