import type { CopilotPortConfig } from './lib/copilot/types';

export const config: CopilotPortConfig = {
  instructions: {
    projectClaudeMd: 'CLAUDE.md',
    globalClaudeMd: '~/.claude/CLAUDE.md',
    applyTo: [
      {
        name: 'react',
        applyTo: 'components/**,app/**/*.tsx',
        sourceSkill: 'react-best-practices',
      },
      {
        name: 'tests',
        applyTo: '**/*.test.{ts,tsx},**/*.spec.ts',
        sourceSkill: 'superpowers:test-driven-development',
      },
      {
        name: 'api-routes',
        applyTo: 'app/api/**',
        sourceSkill: 'vercel:vercel-functions',
      },
      {
        name: 'content',
        applyTo: 'content/**',
        body: 'All content is Zod-validated at build. Schema in `content/schema.ts`. Never inline copy in JSX.',
      },
    ],
  },

  skills: [
    'superpowers:brainstorming',
    'superpowers:writing-plans',
    'superpowers:verification-before-completion',
    'superpowers:systematic-debugging',
    'superpowers:test-driven-development',
    'thinking-pre-mortem',
    'thinking-model-router',
    'thinking-five-whys-plus',
    'commit-commands:commit',
    'commit-commands:commit-push-pr',
    'code-review:code-review',
    'security-review',
    'humanizer',
  ],

  agents: [
    'architect-reviewer',
    'nextjs-developer',
    'typescript-pro',
    'code-reviewer',
    'test-automator',
    'ui-ux-tester',
    'security-auditor',
    'performance-engineer',
    'accessibility-tester',
    'ai-engineer',
    'dx-optimizer',
  ],

  mcp: ['context7', 'chrome-devtools', 'postman', 'vercel'],
};
