import { autoGenHeader } from '../auto-gen-header';
import { emitChatmodeFrontmatter } from '../frontmatter';
import { mapClaudeTools } from '../tool-map';
import type { AgentSource, TranslatorOutput } from '../types';

const DIVERGENCE_NOTE =
  '<!-- Frontmatter `tools:` reflects Copilot tool IDs; prose may reference Claude Code tool names. -->';

export function agentToChatmode(source: AgentSource): TranslatorOutput {
  const fmDescription = (source.frontmatter.description as string | undefined) ?? source.name;
  const claudeTools = Array.isArray(source.frontmatter.tools)
    ? (source.frontmatter.tools as string[])
    : [];
  const { mapped, dropped } = mapClaudeTools(claudeTools);
  if (dropped.length > 0) {
    console.warn(
      `[warn] agentToChatmode(${source.name}): unmapped Claude tools dropped: ${dropped.join(', ')}`,
    );
  }

  const fmOpts: Parameters<typeof emitChatmodeFrontmatter>[0] = {
    description: fmDescription,
    tools: mapped,
  };
  const model = source.frontmatter.model as string | undefined;
  if (model !== undefined) fmOpts.model = model;
  const fm = emitChatmodeFrontmatter(fmOpts);

  const header = autoGenHeader(source.path);
  const content = `${header}\n${DIVERGENCE_NOTE}\n\n${fm}\n\n${source.body.trim()}\n`;

  return { path: `.github/chatmodes/${source.name}.chatmode.md`, content };
}
