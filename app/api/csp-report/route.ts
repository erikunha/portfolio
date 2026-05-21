// app/api/csp-report/route.ts
// CSP violation report collector. Browsers POST JSON violation reports here
// when any directive in the Content-Security-Policy header is breached.
//
// This stub accepts and discards the body (returning 204) so the report-uri
// directive in proxy.ts doesn't generate 404 noise. The JSON report body
// appears in Vercel runtime logs via the implicit Next.js request logging,
// providing baseline violation observability without storing anything.
//
// Upgrade path: parse the body, extract `violated-directive` + `blocked-uri`,
// and emit a structured log line via lib/log.ts if alerting is needed.
export async function POST(): Promise<Response> {
  return new Response(null, { status: 204 });
}
