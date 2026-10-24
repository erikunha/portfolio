import { createMcpHandler } from 'mcp-handler';
import { registerAgentTools } from '@/lib/agent/mcp-tools';

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

export { handler as GET, handler as POST };
