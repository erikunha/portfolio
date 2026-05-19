import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '@/scripts/lib/copilot/frontmatter';
import { createRefRewriter } from '@/scripts/lib/copilot/refs';
import { agentToChatmode } from '@/scripts/lib/copilot/translators/agent-to-chatmode';
import { agentToPrompt } from '@/scripts/lib/copilot/translators/agent-to-prompt';
import { applyToToInstructions } from '@/scripts/lib/copilot/translators/applyto-to-instructions';
import { claudemdToInstructions } from '@/scripts/lib/copilot/translators/claudemd-to-instructions';
import { mcpToVscode } from '@/scripts/lib/copilot/translators/mcp-to-vscode';
import { skillToPrompt } from '@/scripts/lib/copilot/translators/skill-to-prompt';
import type {
  AgentSource,
  McpServerSource,
  PortedNames,
  SkillSource,
  SourceIndex,
} from '@/scripts/lib/copilot/types';
import { fixtureManifest } from './fixtures/manifest';

function loadSkillFixture(p: string): SkillSource {
  const raw = readFileSync(p, 'utf8');
  const { data, content } = parseFrontmatter(raw);
  return {
    kind: 'skill',
    name: (data.name as string) ?? path.basename(p, '.md'),
    qualifiedName: (data.name as string) ?? path.basename(p, '.md'),
    path: p,
    frontmatter: data,
    body: content,
    origin: 'personal',
  };
}

function loadAgentFixture(p: string): AgentSource {
  const raw = readFileSync(p, 'utf8');
  const { data, content } = parseFrontmatter(raw);
  return {
    kind: 'agent',
    name: (data.name as string) ?? path.basename(p, '.md'),
    path: p,
    frontmatter: data,
    body: content,
  };
}

describe('snapshot: full-pipeline output', () => {
  it('claudemd → copilot-instructions.md', () => {
    const source = readFileSync(
      path.resolve(__dirname, '..', '..', fixtureManifest.instructions.projectClaudeMd),
      'utf8',
    );
    const out = claudemdToInstructions(
      source,
      fixtureManifest.instructions.projectClaudeMd,
      new Map() as PortedNames,
      { target: 'project' },
    );
    expect(out.content).toMatchSnapshot();
  });

  it('skill → prompt.md', () => {
    const skill = loadSkillFixture(
      path.resolve(__dirname, 'fixtures/skills/brainstorming-fixture.md'),
    );
    const rw = createRefRewriter(new Map() as PortedNames);
    expect(skillToPrompt(skill, rw).content).toMatchSnapshot();
  });

  it('agent → chatmode.md', () => {
    const agent = loadAgentFixture(path.resolve(__dirname, 'fixtures/agents/reviewer-fixture.md'));
    expect(agentToChatmode(agent).content).toMatchSnapshot();
  });

  it('agent → prompt.md', () => {
    const agent = loadAgentFixture(path.resolve(__dirname, 'fixtures/agents/reviewer-fixture.md'));
    const rw = createRefRewriter(new Map() as PortedNames);
    expect(agentToPrompt(agent, rw).content).toMatchSnapshot();
  });

  it('mcp → mcp.json', () => {
    const fixtureDir = path.resolve(__dirname, 'fixtures/mcp');
    const sources: McpServerSource[] = [
      {
        name: 'context7',
        path: path.join(fixtureDir, 'variant-a-bare.json'),
        config: JSON.parse(readFileSync(path.join(fixtureDir, 'variant-a-bare.json'), 'utf8'))
          .context7,
        origin: 'plugin',
        plugin: 'context7',
      },
      {
        name: 'postman',
        path: path.join(fixtureDir, 'variant-d-http-headers-secrets.json'),
        config: JSON.parse(
          readFileSync(path.join(fixtureDir, 'variant-d-http-headers-secrets.json'), 'utf8'),
        ).mcpServers.postman,
        origin: 'plugin',
        plugin: 'postman',
      },
    ];
    expect(mcpToVscode(sources).content).toMatchSnapshot();
  });

  it('applyTo (inline body) → instructions.md', () => {
    const idx: SourceIndex = { skills: new Map(), agents: new Map(), mcpServers: new Map() };
    const out = applyToToInstructions({ name: 'snap', applyTo: 'src/**', body: 'rule X' }, idx);
    expect(out.content).toMatchSnapshot();
  });
});
