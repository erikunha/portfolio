import { describe, expect, it } from 'vitest';
import { applyToToInstructions } from '@/scripts/lib/copilot/translators/applyto-to-instructions';
import type { ApplyToEntry, SkillSource, SourceIndex } from '@/scripts/lib/copilot/types';

function emptyIndex(): SourceIndex {
  return { skills: new Map(), agents: new Map(), mcpServers: new Map() };
}

const fakeSkill: SkillSource = {
  kind: 'skill',
  name: 'fake-skill',
  qualifiedName: 'fake-skill',
  path: 'fake-skill.md',
  frontmatter: { description: 'a fake skill' },
  body: '## Use this skill when X.\n\nDo Y.',
  origin: 'personal',
};

describe('applyToToInstructions', () => {
  it('writes to .github/instructions/<name>.instructions.md', () => {
    const entry: ApplyToEntry = { name: 'foo', applyTo: 'src/**', body: 'rule' };
    expect(applyToToInstructions(entry, emptyIndex()).path).toBe(
      '.github/instructions/foo.instructions.md',
    );
  });

  it('emits applyTo glob in frontmatter', () => {
    const entry: ApplyToEntry = { name: 'foo', applyTo: 'src/**', body: 'rule' };
    expect(applyToToInstructions(entry, emptyIndex()).content).toContain("applyTo: 'src/**'");
  });

  it('uses inline body when provided', () => {
    const entry: ApplyToEntry = { name: 'foo', applyTo: 'src/**', body: 'inline rule body' };
    expect(applyToToInstructions(entry, emptyIndex()).content).toContain('inline rule body');
  });

  it('extracts body from sourceSkill when provided', () => {
    const idx = emptyIndex();
    idx.skills.set('fake-skill', fakeSkill);
    const entry: ApplyToEntry = { name: 'foo', applyTo: 'src/**', sourceSkill: 'fake-skill' };
    const out = applyToToInstructions(entry, idx);
    expect(out.content).toContain('Use this skill when X');
    expect(out.content).toContain('Do Y');
  });

  it('hard-fails when sourceSkill is not found', () => {
    const entry: ApplyToEntry = { name: 'foo', applyTo: 'src/**', sourceSkill: 'nope' };
    expect(() => applyToToInstructions(entry, emptyIndex())).toThrow(
      /sourceSkill 'nope' not found/,
    );
  });

  it('hard-fails when both sourceSkill and body are provided', () => {
    const entry: ApplyToEntry = {
      name: 'foo',
      applyTo: 'src/**',
      sourceSkill: 'fake-skill',
      body: 'x',
    };
    const idx = emptyIndex();
    idx.skills.set('fake-skill', fakeSkill);
    expect(() => applyToToInstructions(entry, idx)).toThrow(/exactly one of/);
  });
});
