import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '@/scripts/lib/copilot/frontmatter';
import { createRefRewriter } from '@/scripts/lib/copilot/refs';
import { agentToPrompt } from '@/scripts/lib/copilot/translators/agent-to-prompt';
import type { AgentSource, PortedNames } from '@/scripts/lib/copilot/types';

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

describe('agentToPrompt', () => {
  it('writes to .github/prompts/<name>.prompt.md', () => {
    const out = agentToPrompt(loadAgent(), createRefRewriter(new Map() as PortedNames));
    expect(out.path).toBe('.github/prompts/reviewer-fixture.prompt.md');
  });

  it('wraps body with one-shot framing', () => {
    const out = agentToPrompt(loadAgent(), createRefRewriter(new Map() as PortedNames));
    expect(out.content.toLowerCase()).toContain('for this single response, act as');
  });

  it('emits mode: agent in prompt frontmatter', () => {
    const out = agentToPrompt(loadAgent(), createRefRewriter(new Map() as PortedNames));
    expect(out.content).toContain('mode: agent');
  });

  it('maps tools in frontmatter', () => {
    const out = agentToPrompt(loadAgent(), createRefRewriter(new Map() as PortedNames));
    expect(out.content).toContain('read_file');
  });

  it('rewrites [[ref]] in body', () => {
    const a: AgentSource = {
      kind: 'agent',
      name: 'x',
      path: 'fake.md',
      frontmatter: {},
      body: 'See [[code-reviewer]] for guidance.',
    };
    const ported: PortedNames = new Map([['code-reviewer', 'agent']]);
    const out = agentToPrompt(a, createRefRewriter(ported));
    expect(out.content).toContain('@code-reviewer');
  });
});
