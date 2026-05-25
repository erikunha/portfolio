import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// CSP posture: `script-src 'self' 'unsafe-inline'`. No nonce, no x-nonce header rewrite.
//
// Why we are NOT using a nonce-based CSP:
//
// 1) `app/page.tsx` is static-generated. Static HTML
//    is baked at build time, before any request, before any nonce exists.
//    Inline `<script>` tags in the static HTML therefore carry no
//    `nonce` attribute. Per CSP-3 spec §6.7.2.4, when a nonce-source is
//    present in `script-src`, modern browsers IGNORE any co-listed
//    `'unsafe-inline'` keyword and require a matching nonce attribute on
//    every inline script. So `script-src 'nonce-X' 'unsafe-inline'` on a
//    static page blocks every script (verified: 44 violations on
//    `localhost:3000/`, Chrome 138).
//
// 2) The "hybrid nonce" posture (commit ced30d8) anticipated future
//    inline-script use-cases (analytics, embeds) and kept the nonce slot
//    "for future-proofing". There is no nonce consumer today. Combined with
//    the static-generate constraint, the future-proofing cost
//    became real and immediate: a broken page, the entire React 19 RSC
//    flight payload blocked.
//
// 3) The pre-`'unsafe-inline'`-only posture was documented in DECISIONS.md
//    (2026-05-15 "CSP cleanup"): no user-generated content vectors, no XSS
//    surface, inline scripts are framework-emitted (Next/React Float).
//    This file restores that posture.
//
// 4) Re-acquire the nonce ONLY if a future change adds a dynamic route that
//    needs `<script nonce={...}>` (e.g., third-party analytics with a
//    documented nonce requirement). At that point: re-introduce the
//    middleware nonce + x-nonce header rewrite ONLY on that route's
//    matcher pattern, NOT site-wide. The static `/` route must keep the
//    nonce-less CSP for its inline scripts to load.
//
// 5) Hash-based CSP (deferred): replacing `'unsafe-inline'` with SHA-256
//    hashes is not feasible today. Next.js 16 static generation emits RSC
//    flight payloads whose SHA-256 changes on every content edit, meaning
//    hashes must be recomputed and hard-coded in this file on every build.
//    A build-time step that: (a) runs `next build`, (b) scans every
//    generated HTML for inline `<script>` tags, (c) computes SHA-256 of
//    each, and (d) patches this file before the server starts — does not
//    yet exist. Will revisit when a dynamic route with third-party scripts
//    is added (see DECISIONS.md).
//    See also: violation observability via `report-uri /api/csp-report`
//    added below.

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
  // style="" attributes on DOM elements (not-found.tsx).
  // External <link> stylesheets from Next's CSS pipeline are covered by 'self', not 'unsafe-inline'.
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
  // NOTE: https://api.anthropic.com removed — AI calls are server-side only;
  //   no browser fetch ever reaches that origin.
  "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "frame-ancestors 'none'",
  // frame-src: explicit frame blocking (distinct from frame-ancestors which
  // controls who can embed us; frame-src controls what we can embed).
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  // form-action: restricts where form submissions may navigate. Prevents
  // form hijacking to external URLs (relevant to the contact form).
  "form-action 'self'",
  // worker-src: prevents external service worker injection.
  "worker-src 'self'",
  // report-to: Chrome 94+ replacement for report-uri. Both are present —
  // report-to is used by Chromium; report-uri is the fallback for Safari/Firefox.
  // Reporting-Endpoints header (set below) names the endpoint.
  'report-to csp-endpoint',
  'report-uri /api/csp-report',
];

// CSP is identical on every response (no per-request nonce). Pre-join once
// at module-eval. Per-request work in `proxy()` is now just response-header
// assignment.
const CSP = CSP_DIRECTIVES.join('; ');

// The W3C Reporting API spec requires absolute URLs in `Reporting-Endpoints`.
// Chrome 94+ silently ignores relative-URL endpoint values, making `report-to`
// inert. Build the origin from the incoming request so preview deployments
// (which have different domains than production) get a working endpoint too.
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', CSP);
  // Reporting-Endpoints: names the endpoint for `report-to csp-endpoint`.
  // Chrome 94+ uses this header; Safari/Firefox fall back to `report-uri`.
  const origin = new URL(request.url).origin;
  response.headers.set('Reporting-Endpoints', `csp-endpoint="${origin}/api/csp-report"`);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
