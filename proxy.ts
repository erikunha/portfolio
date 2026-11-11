import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const CSP_DIRECTIVES: readonly string[] = [
  "default-src 'self'",
  process.env.NODE_ENV === 'development'
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  // The platform inlines a font as a data: URI when it cannot load it from
  // its own CDN, and the CSP was refusing that font: the browser logged the
  // violation and the best-practices audit lost the points. A font cannot
  // execute script, so allowing the data: scheme here costs the policy
  // nothing that script-src still holds.
  "font-src 'self' data:",
  "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'self'",
  'report-to csp-endpoint',
  'report-uri /api/csp-report',
];

const CSP = CSP_DIRECTIVES.join('; ');

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', CSP);
  const origin = new URL(request.url).origin;
  response.headers.set('Reporting-Endpoints', `csp-endpoint="${origin}/api/csp-report"`);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
