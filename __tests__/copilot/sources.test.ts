import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolvePluginVersion, scanClaudeSources } from '@/scripts/lib/copilot/sources';

const FIXTURE_HOME = path.resolve(__dirname, 'fixtures/sources/claude-home');

describe('resolvePluginVersion', () => {
  it('picks the highest parseable semver among version dirs', () => {
    const pluginDir = path.join(FIXTURE_HOME, 'plugins/cache/marketplaceA/pluginX');
    const resolved = resolvePluginVersion(pluginDir);
    expect(resolved).toBe('5.1.0');
  });

  it('falls back to mtime when no semver dirs exist', () => {
    const pluginDir = path.join(FIXTURE_HOME, 'plugins/cache/marketplaceA/pluginY');
    const resolved = resolvePluginVersion(pluginDir);
    expect(['1a2f18b05cf5', '416e40da03a2']).toContain(resolved);
  });

  it('throws when no version dirs exist', () => {
    const pluginDir = path.join(FIXTURE_HOME, 'plugins/cache/marketplaceA/nonexistent');
    expect(() => resolvePluginVersion(pluginDir)).toThrow(/no version dirs/);
  });
});

describe('scanClaudeSources', () => {
  it('indexes personal skills', () => {
    const idx = scanClaudeSources(FIXTURE_HOME);
    expect(idx.skills.has('personal-skill')).toBe(true);
    const s = idx.skills.get('personal-skill');
    expect(s?.origin).toBe('personal');
    expect(s?.frontmatter.description).toBe('A personal skill fixture');
  });

  it('indexes plugin skills from highest semver version', () => {
    const idx = scanClaudeSources(FIXTURE_HOME);
    expect(idx.skills.has('plugin-skill')).toBe(true);
    const s = idx.skills.get('plugin-skill');
    expect(s?.origin).toBe('plugin');
    expect(s?.plugin).toBe('pluginX');
    expect(s?.frontmatter.description).toBe('From version 5.1.0');
  });

  it('indexes agents from personal agents dir', () => {
    const idx = scanClaudeSources(FIXTURE_HOME);
    expect(idx.agents.has('agent-a')).toBe(true);
    const a = idx.agents.get('agent-a');
    expect(a?.frontmatter.name).toBe('agent-a');
  });
});
