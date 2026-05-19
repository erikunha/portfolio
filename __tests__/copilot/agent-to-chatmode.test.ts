import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '@/scripts/lib/copilot/frontmatter';
import { agentToChatmode } from '@/scripts/lib/copilot/translators/agent-to-chatmode';
import type { AgentSource } from '@/scripts/lib/copilot/types';

const FIXTURE_PATH = path.resolve(__dirname, 'fixtures/agents/reviewer-fixture.md');

function loadAgent(): AgentSource {
  const raw = readFileSync(FIXTURE_PATH, 'utf8');
  const { data, content } = parseFrontmatter(raw);
  return {
    kind: 'agent',
    name: 'reviewer-fixture',
    path: FIXTURE_PATH,
    frontmatter: data,
    body: content,
  };
}

describe('agentToChatmode', () => {
  it('writes to .github/chatmodes/<name>.chatmode.md', () => {
    expect(agentToChatmode(loadAgent()).path).toBe(
      '.github/chatmodes/reviewer-fixture.chatmode.md',
    );
  });

  it('preserves agent body verbatim', () => {
    const out = agentToChatmode(loadAgent());
    expect(out.content).toContain('You are a code reviewer');
    expect(out.content).toContain('read the diff and report issues');
  });

  it('maps Claude tool names to Copilot tool IDs in frontmatter', () => {
    const out = agentToChatmode(loadAgent());
    expect(out.content).toContain('read_file');
    expect(out.content).toContain('grep_search');
    expect(out.content).toContain('file_search');
    expect(out.content).toContain('run_in_terminal');
  });

  it('emits empty tools array when agent has no tools frontmatter', () => {
    const a: AgentSource = {
      kind: 'agent',
      name: 'no-tools',
      path: 'fake.md',
      frontmatter: { description: 'no tools' },
      body: 'body',
    };
    expect(agentToChatmode(a).content).toContain('tools:');
  });

  it('prepends auto-gen header', () => {
    expect(agentToChatmode(loadAgent()).content).toMatch(/^<!-- AUTO-GENERATED/);
  });

  it('includes divergence note about prose tool references', () => {
    const out = agentToChatmode(loadAgent());
    expect(out.content.toLowerCase()).toContain('prose may reference claude code tool names');
  });
});
