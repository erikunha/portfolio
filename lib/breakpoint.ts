// lib/breakpoint.ts
// UA-based mobile detection. Used only to seed initial SSR markup.
// After hydration, matchMedia('(max-width: 768px)') is the source of truth.

const MOBILE_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;

export const MOBILE_BREAKPOINT_PX = 768;

export function detectMobileFromUA(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return MOBILE_REGEX.test(userAgent);
}
