import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '@/scripts/lib/copilot/frontmatter';
import { createRefRewriter } from '@/scripts/lib/copilot/refs';
import { skillToPrompt } from '@/scripts/lib/copilot/translators/skill-to-prompt';
import type { PortedNames, SkillSource } from '@/scripts/lib/copilot/types';

const FIXTURE_PATH = path.resolve(__dirname, 'fixtures/skills/brainstorming-fixture.md');

function loadSkill(): SkillSource {
  const raw = readFileSync(FIXTURE_PATH, 'utf8');
  const { data, content } = parseFrontmatter(raw);
  return {
    kind: 'skill',
    name: 'brainstorming-fixture',
    qualifiedName: 'brainstorming-fixture',
    path: FIXTURE_PATH,
    frontmatter: data,
    body: content,
    origin: 'personal',
  };
}

describe('skillToPrompt', () => {
  it('writes to .github/prompts/<name>.prompt.md', () => {
    const skill = loadSkill();
    const out = skillToPrompt(skill, createRefRewriter(new Map() as PortedNames));
    expect(out.path).toBe('.github/prompts/brainstorming-fixture.prompt.md');
  });

  it('strips <SUBAGENT-STOP> blocks', () => {
    const out = skillToPrompt(loadSkill(), createRefRewriter(new Map() as PortedNames));
    expect(out.content).not.toContain('<SUBAGENT-STOP>');
    expect(out.content).not.toContain('dispatched as a subagent');
  });

  it('strips <EXTREMELY-IMPORTANT> blocks', () => {
    const out = skillToPrompt(loadSkill(), createRefRewriter(new Map() as PortedNames));
    expect(out.content).not.toContain('<EXTREMELY-IMPORTANT>');
    expect(out.content).not.toContain('non-negotiable');
  });

  it('rewrites [[ref]] when ported', () => {
    const ported: PortedNames = new Map([['writing-plans', 'skill']]);
    const out = skillToPrompt(loadSkill(), createRefRewriter(ported));
    expect(out.content).toContain('/writing-plans');
    expect(out.content).not.toContain('[[writing-plans]]');
  });

  it('prepends auto-gen header', () => {
    const out = skillToPrompt(loadSkill(), createRefRewriter(new Map() as PortedNames));
    expect(out.content).toMatch(/^<!-- AUTO-GENERATED/);
  });

  it('emits valid YAML frontmatter with mode: agent', () => {
    const out = skillToPrompt(loadSkill(), createRefRewriter(new Map() as PortedNames));
    expect(out.content).toMatch(/^<!--[\s\S]*?-->\n\n---\n/);
    expect(out.content).toContain('mode: agent');
  });
});
