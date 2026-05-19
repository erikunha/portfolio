// lib/get-is-mobile-for-request.ts
// Per-request memoized UA-based mobile detection.
//
// React's `cache` deduplicates the `headers()` read + UA parse across all
// callers within a single RSC render. Multiple sections (Module, page.tsx,
// ProjectsSection, GitLogSection, GuitarSection, VisaSection, ...) can all
// `await getIsMobileForRequest()` independently — only one parse runs per
// request. `cache` is request-scoped, so no cross-request leak.

import { headers } from 'next/headers';
import { cache } from 'react';
import { detectMobileFromUA } from './breakpoint';

export const getIsMobileForRequest = cache(async (): Promise<boolean> => {
  const ua = (await headers()).get('user-agent');
  return detectMobileFromUA(ua);
});
