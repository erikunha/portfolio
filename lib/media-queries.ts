import { MOBILE_BREAKPOINT_PX } from './breakpoint';

const MAX_WIDTH_STEP_PX = 0.02;
const MAX_WIDTH_DECIMALS = 2;

export const MOBILE_QUERY = `(max-width: ${(MOBILE_BREAKPOINT_PX - MAX_WIDTH_STEP_PX).toFixed(MAX_WIDTH_DECIMALS)}px)`;

export const isMobileViewport = () => window.matchMedia(MOBILE_QUERY).matches;

export function watchMobileViewport(onChange: (isMobile: boolean) => void): () => void {
  const query = window.matchMedia(MOBILE_QUERY);
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
