import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { claudemdToInstructions } from '@/scripts/lib/copilot/translators/claudemd-to-instructions';
import type { PortedNames } from '@/scripts/lib/copilot/types';

const FIXTURE = path.resolve(__dirname, 'fixtures/claudemd/sample.md');

describe('claudemdToInstructions', () => {
  it('prepends auto-gen header', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const out = claudemdToInstructions(source, FIXTURE, new Map() as PortedNames, {
      target: 'project',
    });
    expect(out.content.startsWith('<!-- AUTO-GENERATED')).toBe(true);
  });

  it('rewrites "<agent> agent" to /<agent> or @<agent> when agent is ported', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const ported: PortedNames = new Map([['architect-reviewer', 'agent']]);
    const out = claudemdToInstructions(source, FIXTURE, ported, { target: 'project' });
    expect(out.content).toMatch(/@architect-reviewer|\/architect-reviewer/);
    expect(out.content).not.toContain('architect-reviewer agent');
  });

  it('rewrites "<skill> skill" to /<skill> when skill is ported', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const ported: PortedNames = new Map([['superpowers:brainstorming', 'skill']]);
    const out = claudemdToInstructions(source, FIXTURE, ported, { target: 'project' });
    expect(out.content).toContain('/superpowers:brainstorming');
  });

  it('writes to .github/copilot-instructions.md when target=project', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const out = claudemdToInstructions(source, FIXTURE, new Map() as PortedNames, {
      target: 'project',
    });
    expect(out.path).toBe('.github/copilot-instructions.md');
  });

  it('annotates dispatch table with auto-trigger warning', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const out = claudemdToInstructions(source, FIXTURE, new Map() as PortedNames, {
      target: 'project',
    });
    expect(out.content.toLowerCase()).toContain('auto-trigger is claude code only');
  });
});
