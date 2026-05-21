import { HIRING_PROFILE } from '@/lib/hiring-profile';

// The profile constant lives in `lib/hiring-profile.ts` — one source of truth
// shared with the MCP server's `get_profile` tool so the two agent-facing
// surfaces (this GET document + the MCP tool) can never drift.

export async function GET(): Promise<Response> {
  // Deliberate exemption from the `lib/server/route.ts` envelope (STANDARDS.md
  // Ch. 2): erik.json is a machine-readable resume *document*, not an
  // *operation* — agent crawlers fetch it expecting a plain profile, and
  // wrapping it in `{ ok, requestId, data }` would break those consumers.
  //
  // No `X-Request-Id`: this route has no dynamic API usage, so dynamicIO
  // auto-detects it as static and the response is built once and served from
  // cache. An id minted here would be a build-time constant that could never
  // correlate to an individual request — emitting one would be observability
  // theater (STANDARDS.md Ch. 9).
  return Response.json(HIRING_PROFILE, {
    headers: {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
