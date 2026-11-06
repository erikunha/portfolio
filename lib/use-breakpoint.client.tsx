'use client';

import { useSyncExternalStore } from 'react';
import { MOBILE_QUERY } from './media-queries';

type Breakpoint = {
  isMobile: boolean;
};

function subscribe(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const readMobile = () => window.matchMedia(MOBILE_QUERY).matches;
const readMobileOnServer = () => false;

export function useBreakpoint(): Breakpoint {
  return { isMobile: useSyncExternalStore(subscribe, readMobile, readMobileOnServer) };
}
