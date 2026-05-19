import type { CopilotPortConfig } from '@/scripts/lib/copilot/types';

export const fixtureManifest: CopilotPortConfig = {
  instructions: {
    projectClaudeMd: '__tests__/copilot/fixtures/claudemd/sample.md',
    globalClaudeMd: '__tests__/copilot/fixtures/claudemd/sample.md',
    applyTo: [],
  },
  skills: [],
  agents: [],
  mcp: [],
};
