import matter from 'gray-matter';

/**
 * VS Code Copilot frontmatter target version. Bump when the upstream schema
 * changes; emitters are pinned to this version.
 */
export const COPILOT_TARGET_VERSION = '1.95.x';

export type PromptFrontmatter = {
  mode: 'agent' | 'ask' | 'edit';
  description: string;
  tools?: string[];
  model?: string;
};

export type ChatmodeFrontmatter = {
  description: string;
  tools?: string[];
  model?: string;
};

export type InstructionsFrontmatter = {
  applyTo: string;
};

export function parseFrontmatter(source: string): {
  data: Record<string, unknown>;
  content: string;
} {
  const parsed = matter(source);
  return { data: parsed.data, content: parsed.content };
}

function needsQuoting(s: string): boolean {
  return /[:#&*!|>'"%@`{}[\]]|^[-?]|^\s|\s$/.test(s);
}

function emitYamlBlock(data: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${typeof item === 'string' ? item : JSON.stringify(item)}`);
      }
    } else if (typeof value === 'string') {
      lines.push(`${key}: ${needsQuoting(value) ? `'${value.replace(/'/g, "''")}'` : value}`);
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

export function emitPromptFrontmatter(fm: PromptFrontmatter): string {
  return emitYamlBlock({ ...fm });
}

export function emitChatmodeFrontmatter(fm: ChatmodeFrontmatter): string {
  return emitYamlBlock({ ...fm });
}

export function emitInstructionsFrontmatter(fm: InstructionsFrontmatter): string {
  return emitYamlBlock({ applyTo: fm.applyTo });
}
