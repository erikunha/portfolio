// app/api/csp-report/route.ts
// CSP violation report collector. Browsers POST JSON violation reports here
// when any directive in the Content-Security-Policy header is breached.
//
// Returns 204 to acknowledge receipt and prevent 404 noise from the report-uri
// directive in proxy.ts. The violation body is intentionally not read — the
// signal that the endpoint was hit at all is visible in Vercel Function logs.
//
// Upgrade path: parse body, extract `violated-directive` + `blocked-uri`, emit
// a structured lib/log.ts line if alerting on specific violations is needed.
export async function POST(): Promise<Response> {
  return new Response(null, { status: 204 });
}
