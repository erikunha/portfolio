import { createMcpHandler } from 'mcp-handler';
import { registerAgentTools } from '@/lib/agent/mcp-tools';
import { withBodyLimit } from '@/lib/server/body-limit';

const MAX_MCP_BODY_BYTES = 4096;

const handler = createMcpHandler(
  (server) => {
    registerAgentTools(server);
  },
  {
    serverInfo: {
      name: 'erikunha.dev',
      version: '1.0.0',
    },
  },
  {
    basePath: '/api',
    maxDuration: 60,
  },
);

export const POST = withBodyLimit(handler, MAX_MCP_BODY_BYTES);
export { handler as GET };
