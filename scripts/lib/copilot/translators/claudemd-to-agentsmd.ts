import { autoGenHeader } from '../auto-gen-header';
import type { TranslatorOutput } from '../types';

const AI_PREFACE = `## For AI Agents

This file is the **tool-agnostic** version of \`CLAUDE.md\`. Every binding rule below applies to every AI coding agent operating in this repo: Claude Code, Copilot, Cursor, Codex, Aider, and future tools.

**Hard rule — PR merges:** No agent may call \`gh pr merge\` while any GitHub review thread on the PR has \`isResolved: false\`. The gate is mechanically enforced by \`pnpm ready-to-merge\` and by GitHub branch protection (\`required_conversation_resolution\`). See the **PR merge gate** section below for the full contract — RESOLVE or ESCALATE; no third option.

`;

export function claudemdToAgentsMd(source: string, sourcePath: string): TranslatorOutput {
  const header = autoGenHeader(sourcePath);
  const content = `${header}\n\n${AI_PREFACE}${source}`;
  return { path: 'AGENTS.md', content };
}
