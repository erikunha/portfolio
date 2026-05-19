import { describe, expect, it } from 'vitest';
import { analyzeDrift } from '@/scripts/check-copilot-drift';

describe('analyzeDrift', () => {
  it('passes when no source files changed', () => {
    expect(analyzeDrift(['README.md', 'package.json']).ok).toBe(true);
  });

  it('passes when source changed AND generated changed in same diff', () => {
    expect(analyzeDrift(['CLAUDE.md', '.github/copilot-instructions.md']).ok).toBe(true);
  });

  it('fails when CLAUDE.md changed without any generated file', () => {
    const r = analyzeDrift(['CLAUDE.md']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/CLAUDE\.md.*regenerate/);
  });

  it('fails when manifest changed without any generated file', () => {
    const r = analyzeDrift(['scripts/copilot-port.config.ts']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/copilot-port\.config\.ts.*regenerate/);
  });

  it('accepts any matching generated artifact', () => {
    expect(analyzeDrift(['CLAUDE.md', '.github/prompts/foo.prompt.md']).ok).toBe(true);
    expect(analyzeDrift(['CLAUDE.md', '.github/chatmodes/x.chatmode.md']).ok).toBe(true);
    expect(analyzeDrift(['CLAUDE.md', '.github/instructions/y.instructions.md']).ok).toBe(true);
    expect(analyzeDrift(['CLAUDE.md', '.vscode/mcp.json']).ok).toBe(true);
  });
});
