import { autoGenHeader } from '../auto-gen-header';
import { emitPromptFrontmatter } from '../frontmatter';
import type { RefRewriter } from '../refs';
import { mapClaudeTools } from '../tool-map';
import type { AgentSource, TranslatorOutput } from '../types';

export function agentToPrompt(source: AgentSource, rw: RefRewriter): TranslatorOutput {
  const fmDescription = (source.frontmatter.description as string | undefined) ?? source.name;
  const claudeTools = Array.isArray(source.frontmatter.tools)
    ? (source.frontmatter.tools as string[])
    : [];
  const { mapped } = mapClaudeTools(claudeTools);

  const fmOpts: Parameters<typeof emitPromptFrontmatter>[0] = {
    mode: 'agent',
    description: `One-shot invocation: ${fmDescription}`,
    tools: mapped,
  };
  const model = source.frontmatter.model as string | undefined;
  if (model !== undefined) fmOpts.model = model;
  const fm = emitPromptFrontmatter(fmOpts);

  const rewritten = rw.rewrite(source.body.trim());
  const framing = `For this single response, act as the **${source.name}** agent. Persona:\n\n`;

  const header = autoGenHeader(source.path);
  const content = `${header}\n\n${fm}\n\n${framing}${rewritten}\n`;

  return { path: `.github/prompts/${source.name}.prompt.md`, content };
}
