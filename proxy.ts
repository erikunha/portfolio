import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// CSP nonce posture (PR 3 of audit roadmap, see
// docs/audit/2026-05-19-principal-audit.md Theme 2 + Debate 1):
//
// 1) The `x-nonce` request-header rewrite is REQUIRED, not dead code.
//    Next.js's framework runtime reads `headers().get('x-nonce')` during
//    SSR and attributes the nonce to its auto-injected inline scripts
//    (RSC flight payloads, hydration data). Without the rewrite, Next
//    emits ~40+ inline `<script>` tags WITHOUT the nonce, and Chrome
//    blocks every one of them — fatal to hydration. Verified empirically
//    via Chrome Issues panel (44 violations on every page load when the
//    rewrite was absent). The audit's initial diagnosis greppped the
//    repo for `x-nonce` consumers and found none in user code, missing
//    the transitive Next-internal consumer. Drift-protected by
//    `__tests__/proxy-csp.test.ts` (asserts request headers carry the
//    same nonce as the response CSP).
//
// 2) Entropy: 16 random bytes → 128 bits → 24-char base64,
//    spec-conformant for the CSP nonce. The prior implementation
//    base64-encoded the 36-character UUID *string* (including dashes),
//    which produced a 48-char nonce backed by only ~122 bits of
//    entropy drawn from the limited UUID alphabet — under the CSP
//    "≥ 128 bits" recommendation.
//
// 3) Static parts of the CSP are hoisted to module scope. Only the
//    nonce-bearing `script-src` directive is rebuilt per request.

const STATIC_CSP_DIRECTIVES: readonly string[] = [
  "default-src 'self'",
  // 'unsafe-inline' required: React JSX style={{}} props produce inline
  // style="" attributes on DOM elements (not-found.tsx, opengraph-image.tsx).
  // style-src does not support nonces for element-level inline styles;
  // 'unsafe-inline' is the only way to allow them. Tailwind was removed
  // 2026-05-18 — it is no longer the reason.
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

// Pre-join the static directives at module-eval. Per-request work is now
// only the nonce + the dev-mode script-src branch.
const STATIC_CSP = STATIC_CSP_DIRECTIVES.join('; ');

function mintNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64');
}

function buildScriptSrc(nonce: string): string {
  // - 'self' covers same-origin static scripts (Next's chunks, /init.js).
  // - 'nonce-...' covers Next's auto-injected inline RSC flight + hydration
  //   scripts. Next reads `headers().get('x-nonce')` during SSR and
  //   attributes the nonce to every `<script>` it emits.
  // - 'unsafe-eval' is dev-only: Next's HMR runtime evaluates strings.
  // - https://va.vercel-scripts.com (script-src): dev only. The dev-mode
  //   Vercel Analytics SDK loads its script from here. Production uses
  //   same-origin /_vercel/insights/script.js.
  const base = `script-src 'self' 'nonce-${nonce}'`;
  if (process.env.NODE_ENV === 'development') {
    return `${base} 'unsafe-eval' https://va.vercel-scripts.com`;
  }
  return base;
}

export function proxy(request: NextRequest) {
  const nonce = mintNonce();
  const csp = `${buildScriptSrc(nonce)}; ${STATIC_CSP}`;

  // Set `x-nonce` on the upstream request headers so Next's SSR runtime
  // can read it via `headers().get('x-nonce')` and attribute the same
  // nonce to every inline `<script>` it emits. See the file-level comment
  // §1 for why this is required (Next-internal consumer, missed by the
  // audit's source-grep).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
