import { createMcpHandler } from 'mcp-handler';
import { registerAgentTools } from '@/lib/agent/mcp-tools';
import { getMcpLimit } from '@/lib/rate-limit';
import { withBodyLimit } from '@/lib/server/body-limit';
import { withRateLimit } from '@/lib/server/rate-limit-guard';

const MAX_MCP_BODY_BYTES = 4096;

export const maxDuration = 60;

const MCP_MAX_SUBSCRIPTIONS = 0;

const handler = createMcpHandler(
  (server) => {
    registerAgentTools(server);
  },
  {
    maxSubscriptions: MCP_MAX_SUBSCRIPTIONS,
    serverInfo: {
      name: 'erikunha.dev',
      version: '1.0.0',
    },
  },
);

const MCP_RATE_LIMIT_MESSAGE = 'too many requests';

export const POST = withRateLimit(
  withBodyLimit(handler, MAX_MCP_BODY_BYTES),
  getMcpLimit,
  MCP_RATE_LIMIT_MESSAGE,
);
export const GET = withRateLimit(handler, getMcpLimit, MCP_RATE_LIMIT_MESSAGE);
