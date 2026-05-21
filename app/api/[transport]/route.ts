// app/api/[transport]/route.ts
//
// Read-only MCP (Model Context Protocol) server for erikunha.dev.
//
// Hosted with `mcp-handler` (the maintained successor to @vercel/mcp-adapter)
// — `createMcpHandler` returns a Next.js route handler exported as GET/POST.
// The `[transport]` dynamic segment is the package's required convention: the
// streamable-HTTP transport resolves at `/api/mcp`, SSE at `/api/sse`. Static
// sibling segments (`ask`, `contact`, `erik.json`, `lighthouse`, `log`) take
// routing precedence over this dynamic segment, so no existing route is
// shadowed.
//
// The two tools (`get_profile`, `ask_erik`) are registered by
// `registerAgentTools` in `lib/agent/mcp-tools.ts` — factored out so the same
// tool surface is unit-testable against a bare McpServer. The server is
// read-only: no auth, no new infrastructure, no database. `get_profile` reuses
// the shared `HIRING_PROFILE`; `ask_erik` reuses the real /api/ask handler.
//
// Node runtime: `mcp-handler` and the MCP SDK pull in Node built-ins
// (`node:crypto`, stream internals) that the Edge runtime does not provide.
// The two reused dependencies — the HIRING_PROFILE constant and the /api/ask
// route — are runtime-agnostic, so this does not constrain them.

import { createMcpHandler } from 'mcp-handler';
import { registerAgentTools } from '@/lib/agent/mcp-tools';

// Node runtime: `mcp-handler` and the MCP SDK pull in Node built-ins
// (`node:crypto`, stream internals). On Vercel, Next.js App Router routes
// default to the Node.js serverless runtime — `runtime = 'nodejs'` is not
// needed. This comment remains for audit clarity.

// `maxDuration` bounds the streamable-HTTP/SSE connection. `ask_erik` proxies
// /api/ask, whose own request budget is 30s — 60s leaves headroom for the MCP
// framing around it without holding a connection open indefinitely.
const handler = createMcpHandler(
  (server) => {
    registerAgentTools(server);
  },
  {
    serverInfo: {
      name: 'erikunha.dev',
      version: '1.0.0',
    },
    // No explicit `capabilities`: the MCP SDK advertises the `tools`
    // capability automatically on the first `registerTool` call. An empty
    // `capabilities: { tools: {} }` here is redundant.
  },
  {
    // `basePath` must equal the static path prefix that the `[transport]`
    // dynamic segment sits under. This route file is `app/api/[transport]/
    // route.ts`, so the prefix is `/api`. `mcp-handler`'s
    // `deriveEndpointsFromBasePath('/api')` produces the streamable-HTTP
    // endpoint `'/api/mcp'`, which it then exact-matches against
    // `url.pathname`; for `POST /api/mcp` they are equal, so the request is
    // served (verified live — see `__tests__/agent-surfaces.test.ts`, which
    // pins the derived endpoint to `/api/mcp` against this `basePath`).
    basePath: '/api',
    maxDuration: 60,
  },
);

export { handler as GET, handler as POST };
