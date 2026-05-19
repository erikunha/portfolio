import { autoGenHeader } from '../auto-gen-header';
import { emitInstructionsFrontmatter } from '../frontmatter';
import type { ApplyToEntry, SourceIndex, TranslatorOutput } from '../types';

export function applyToToInstructions(entry: ApplyToEntry, sources: SourceIndex): TranslatorOutput {
  const hasBody = typeof entry.body === 'string' && entry.body.length > 0;
  const hasSkill = typeof entry.sourceSkill === 'string' && entry.sourceSkill.length > 0;

  if (hasBody === hasSkill) {
    throw new Error(
      `applyTo entry '${entry.name}': exactly one of \`body\` or \`sourceSkill\` is required (both or neither were provided)`,
    );
  }

  let body: string;
  let sourcePath: string;

  if (hasSkill) {
    const skillName = entry.sourceSkill as string;
    const bareName = skillName.includes(':') ? (skillName.split(':')[1] ?? skillName) : skillName;
    const skill = sources.skills.get(bareName);
    if (!skill) {
      throw new Error(`applyTo entry '${entry.name}': sourceSkill '${skillName}' not found`);
    }
    body = skill.body.trim();
    sourcePath = skill.path;
  } else {
    body = entry.body as string;
    sourcePath = `inline body in scripts/copilot-port.config.ts (entry: ${entry.name})`;
  }

  const fm = emitInstructionsFrontmatter({ applyTo: entry.applyTo });
  const header = autoGenHeader(sourcePath);
  const content = `${header}\n\n${fm}\n\n${body}\n`;

  return { path: `.github/instructions/${entry.name}.instructions.md`, content };
}
