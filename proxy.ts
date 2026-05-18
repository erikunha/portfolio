import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = [
    "default-src 'self'",
    // 'self' covers same-origin static scripts (Next's chunks, /init.js).
    // 'nonce-...' covers Next's auto-injected inline data scripts (flight payloads, hydration).
    // 'strict-dynamic' intentionally absent: site has no third-party scripts and CLAUDE.md
    // rejects all categories that would justify transitive nonce trust (analytics, CMS, auth, CAPTCHA).
    // See DECISIONS.md (2026-05-18).
    // CSP origin notes (Spec 2 Phase 1):
    //   - https://vitals.vercel-insights.com: legacy ingest endpoint for
    //     @vercel/analytics + @vercel/speed-insights. Current SDK versions
    //     prefer same-origin /_vercel/insights/* via Vercel's edge router,
    //     but this remains as defensive coverage for future SDK changes.
    //   - https://va.vercel-scripts.com (script-src, dev only): the dev-mode
    //     SDK loads its script from here. Production uses same-origin
    //     /_vercel/insights/script.js so no production widening needed.
    `script-src 'self' 'nonce-${nonce}'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval' https://va.vercel-scripts.com" : ''}`,
    // 'unsafe-inline' required: Tailwind v4 injects styles at runtime; React inline style props cannot use nonces
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://api.anthropic.com https://vitals.vercel-insights.com https://va.vercel-scripts.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
