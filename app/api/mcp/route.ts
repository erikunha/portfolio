import { createMcpHandler } from 'mcp-handler';
import { registerAgentTools } from '@/lib/agent/mcp-tools';
import { withBodyLimit } from '@/lib/server/body-limit';

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

export const POST = withBodyLimit(handler, MAX_MCP_BODY_BYTES);
export { handler as GET };
