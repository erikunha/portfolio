import { autoGenHeader } from '../auto-gen-header';
import { emitPromptFrontmatter } from '../frontmatter';
import type { RefRewriter } from '../refs';
import type { SkillSource, TranslatorOutput } from '../types';

const STRIP_TAGS = ['SUBAGENT-STOP', 'EXTREMELY-IMPORTANT', 'EXTREMELY_IMPORTANT'];

function stripTagBlocks(body: string): string {
  let out = body;
  for (const tag of STRIP_TAGS) {
    const re = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'gi');
    out = out.replace(re, '');
  }
  out = out.replace(/^.*invoke the Skill tool.*$\n?/gim, '');
  out = out.replace(/\n{2,}/g, '\n\n');
  return out;
}

export function skillToPrompt(source: SkillSource, rw: RefRewriter): TranslatorOutput {
  const fmDescription = (source.frontmatter.description as string | undefined) ?? '';
  const userFacingDescription =
    'Manually-invoked prompt — Copilot does not auto-trigger by description. ' +
    `Original Claude Code skill: ${source.qualifiedName}.`;

  const fm = emitPromptFrontmatter({
    mode: 'agent',
    description: userFacingDescription,
  });

  const stripped = stripTagBlocks(source.body);
  const rewritten = rw.rewrite(stripped);

  const whenToUse = fmDescription ? `\n\n## When to use\n\n${fmDescription}\n` : '';

  const header = autoGenHeader(source.path);
  const content = `${header}\n\n${fm}\n${whenToUse}${rewritten}\n`;

  return { path: `.github/prompts/${source.name}.prompt.md`, content };
}
