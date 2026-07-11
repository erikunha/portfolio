import { createMcpHandler } from 'mcp-handler';
import { registerAgentTools } from '@/lib/agent/mcp-tools';

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

export { handler as GET, handler as POST };
