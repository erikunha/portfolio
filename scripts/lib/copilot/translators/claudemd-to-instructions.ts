import { autoGenHeader } from '../auto-gen-header';
import type { PortedNames, TranslatorOutput } from '../types';

type Options = {
  /** 'project' → .github/copilot-instructions.md; 'user' → user-level fallback */
  target: 'project' | 'user';
};

const DISPATCH_TABLE_NOTE =
  '\n> **Note:** Auto-trigger is Claude Code only. In Copilot Chat, invoke each prompt manually via `/<name>` or switch to the chat mode via `@<name>`.\n';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function claudemdToInstructions(
  source: string,
  sourcePath: string,
  portedNames: PortedNames,
  opts: Options,
): TranslatorOutput {
  let body = source;

  for (const [name, kind] of portedNames) {
    if (kind === 'agent') {
      const re = new RegExp(`\\b${escapeRegex(name)}\\s+agent\\b`, 'g');
      body = body.replace(re, `@${name} chat mode (or /${name} for one-shot)`);
    } else {
      const re = new RegExp(`\\b${escapeRegex(name)}\\s+skill\\b`, 'g');
      body = body.replace(re, `/${name}`);
    }
  }

  body = body.replace(/^(##\s+.*dispatch.*)$/gim, `$1${DISPATCH_TABLE_NOTE}`);

  const header = autoGenHeader(sourcePath);
  const content = `${header}\n\n${body}`;

  const outPath =
    opts.target === 'project'
      ? '.github/copilot-instructions.md'
      : '.copilot-port-output/copilot-user-instructions.md';

  return { path: outPath, content };
}
