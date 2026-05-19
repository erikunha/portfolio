import { describe, expect, it } from 'vitest';
import {
  COPILOT_TARGET_VERSION,
  emitChatmodeFrontmatter,
  emitInstructionsFrontmatter,
  emitPromptFrontmatter,
  parseFrontmatter,
} from '@/scripts/lib/copilot/frontmatter';

describe('COPILOT_TARGET_VERSION', () => {
  it('is a non-empty string', () => {
    expect(typeof COPILOT_TARGET_VERSION).toBe('string');
    expect(COPILOT_TARGET_VERSION.length).toBeGreaterThan(0);
  });
});

describe('parseFrontmatter', () => {
  it('returns empty frontmatter for body-only content', () => {
    const { data, content } = parseFrontmatter('# Hello\n');
    expect(data).toEqual({});
    expect(content).toBe('# Hello\n');
  });

  it('parses YAML frontmatter and body separately', () => {
    const src = '---\nname: x\ndescription: y\n---\n# Body\n';
    const { data, content } = parseFrontmatter(src);
    expect(data).toEqual({ name: 'x', description: 'y' });
    expect(content.trim()).toBe('# Body');
  });
});

describe('emitPromptFrontmatter', () => {
  it('emits mode and description in YAML block', () => {
    const out = emitPromptFrontmatter({ mode: 'agent', description: 'Test' });
    expect(out).toMatch(/^---\n/);
    expect(out).toContain('mode: agent');
    expect(out).toContain('description: Test');
    expect(out.trimEnd().endsWith('---')).toBe(true);
  });

  it('emits tools array when provided', () => {
    const out = emitPromptFrontmatter({
      mode: 'agent',
      description: 'x',
      tools: ['read_file', 'grep_search'],
    });
    expect(out).toContain('tools:');
    expect(out).toContain('read_file');
    expect(out).toContain('grep_search');
  });
});

describe('emitChatmodeFrontmatter', () => {
  it('emits description and tools for chat mode', () => {
    const out = emitChatmodeFrontmatter({ description: 'persona', tools: ['read_file'] });
    expect(out).toContain('description: persona');
    expect(out).toContain('read_file');
  });
});

describe('emitInstructionsFrontmatter', () => {
  it('emits applyTo glob', () => {
    const out = emitInstructionsFrontmatter({ applyTo: 'components/**' });
    expect(out).toContain("applyTo: 'components/**'");
  });
});
