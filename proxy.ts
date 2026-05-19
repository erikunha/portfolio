import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// CSP posture (PR 4 of audit roadmap — supersedes PR 3 hybrid nonce):
//
// `script-src 'self' 'unsafe-inline'`. No nonce, no x-nonce header rewrite.
//
// Why we are NOT using a nonce-based CSP:
//
// 1) `app/page.tsx` is static-generated (audit Theme 3 / PR 1). Static HTML
//    is baked at build time, before any request, before any nonce exists.
//    Inline `<script>` tags in the static HTML therefore carry no
//    `nonce` attribute. Per CSP-3 spec §6.7.2.4, when a nonce-source is
//    present in `script-src`, modern browsers IGNORE any co-listed
//    `'unsafe-inline'` keyword and require a matching nonce attribute on
//    every inline script. So `script-src 'nonce-X' 'unsafe-inline'` on a
//    static page blocks every script (verified: 44 violations on
//    `localhost:3000/`, Chrome 138).
//
// 2) The "hybrid nonce" posture shipped in PR 3 of the audit roadmap
//    (commit ced30d8) anticipated future inline-script use-cases (analytics,
//    embeds) and kept the nonce slot "for future-proofing". The audit's
//    Theme 2 acknowledged the nonce has no consumer today. Combined with
//    the static-generate move from Theme 3, the future-proofing cost
//    became real and immediate: a broken page, the entire React 19 RSC
//    flight payload blocked.
//
// 3) The pre-audit posture (DECISIONS.md 2026-05-15 "CSP cleanup") was
//    `'unsafe-inline'`. That ADR documented the reasoning at length: no
//    user-generated content vectors, no XSS surface, inline scripts are
//    framework-emitted (Next/React Float). PR 4 restores this posture.
//    The audit's entropy-fix work (Theme 2.3) and static-CSP hoisting
//    (Theme 2.4) are moot once the nonce is dropped.
//
// 4) Re-acquire the nonce ONLY if a future PR adds a dynamic route that
//    needs `<script nonce={...}>` (e.g., third-party analytics with a
//    documented nonce requirement). At that point: re-introduce the
//    middleware nonce + x-nonce header rewrite ONLY on that route's
//    matcher pattern, NOT site-wide. The static `/` route must keep the
//    nonce-less CSP for its inline scripts to load.

const CSP_DIRECTIVES: readonly string[] = [
  "default-src 'self'",
  // 'self' covers same-origin static scripts (Next's chunks, /init.js).
  // 'unsafe-inline' covers React 19 Float's RSC flight payload + hydration
  // scripts that ship inline in the static HTML. See file-level comment §1.
  // 'unsafe-eval' is dev-only: Next's HMR runtime evaluates strings.
  // https://va.vercel-scripts.com (script-src): dev only.
  process.env.NODE_ENV === 'development'
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com"
    : "script-src 'self' 'unsafe-inline'",
  // style-src 'unsafe-inline': React JSX style={{}} props produce inline
  // style="" attributes on DOM elements (not-found.tsx, opengraph-image.tsx).
  // Also the all-CSS inline `<style>` block from lib/inline-css.ts (PR 1).
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // - https://vitals.vercel-insights.com: legacy ingest endpoint for
  //   @vercel/analytics + @vercel/speed-insights. Current SDK versions
  //   prefer same-origin /_vercel/insights/* via Vercel's edge router,
  //   but this remains as defensive coverage for future SDK changes.
  // - https://va.vercel-scripts.com (connect-src): present in ALL environments.
  //   The Analytics runtime may fetch additional resources (config, chunks)
  //   from this origin even when the entry script is served same-origin.
  "connect-src 'self' https://api.anthropic.com https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
];

// CSP is identical on every response (no per-request nonce). Pre-join once
// at module-eval. Per-request work in `proxy()` is now just response-header
// assignment.
const CSP = CSP_DIRECTIVES.join('; ');

// `_request` is intentional: the Next runtime calls proxy(request) but the
// CSP no longer depends on the request (no nonce). Renaming to `_request`
// documents the intent and silences `noUnusedVariables`.
export function proxy(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', CSP);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
