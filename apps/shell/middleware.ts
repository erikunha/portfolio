import { NextRequest, NextResponse } from 'next/server';

// Generate unique request ID for tracing
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Simple in-memory rate limiter
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = process.env.NODE_ENV === 'test' ? 200 : 60; // Higher limit for tests

function rateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetTime) {
    // New window or expired entry
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Rate limit exceeded
  }

  entry.count++;
  return true;
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);

export function middleware(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || generateRequestId();
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and internal Next.js routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // Files with extensions (images, manifest, etc.)
  ) {
    const response = NextResponse.next();
    response.headers.set('x-request-id', requestId);
    return response;
  }

  // Get client identifier (IP or fallback)
  const clientIp =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // Skip rate limiting in development and test environments
  const bypassRateLimit =
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test' ||
    request.headers.get('x-bypass-rate-limit') === 'true';

  // Apply rate limiting (unless bypassed)
  if (!bypassRateLimit && !rateLimit(clientIp)) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        message: 'Please slow down and try again later',
      },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': String(MAX_REQUESTS_PER_WINDOW),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  // Continue with the request
  const response = NextResponse.next();

  // Add request ID to response headers
  response.headers.set('x-request-id', requestId);

  // Add security headers for portfolio site
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );

  // Log request in production (structured JSON)
  if (process.env.NODE_ENV === 'production') {
    console.info(
      JSON.stringify({
        '@timestamp': new Date().toISOString(),
        level: 'info',
        type: 'http.request',
        service: 'erikunha-portfolio',
        environment: process.env.NODE_ENV,
        requestId,
        method: request.method,
        path: request.nextUrl.pathname,
        clientIp,
      }),
    );
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|site.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
