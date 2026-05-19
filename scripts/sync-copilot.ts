#!/usr/bin/env tsx
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config } from './copilot-port.config';
import { createRefRewriter } from './lib/copilot/refs';
import { scanClaudeSources } from './lib/copilot/sources';
import { agentToChatmode } from './lib/copilot/translators/agent-to-chatmode';
import { agentToPrompt } from './lib/copilot/translators/agent-to-prompt';
import { claudemdToInstructions } from './lib/copilot/translators/claudemd-to-instructions';
import { mcpToVscode } from './lib/copilot/translators/mcp-to-vscode';
import { skillToPrompt } from './lib/copilot/translators/skill-to-prompt';
import type { AgentSource, PortedNames, SkillSource, TranslatorOutput } from './lib/copilot/types';

type Flags = {
  dryRun: boolean;
  diff: boolean;
  verbose: boolean;
  only?: string;
};

function parseFlags(argv: string[]): Flags {
  const onlyRaw = argv.find((a) => a.startsWith('--only='))?.split('=')[1];
  const flags: Flags = {
    dryRun: argv.includes('--dry-run'),
    diff: argv.includes('--diff'),
    verbose: argv.includes('--verbose'),
  };
  if (onlyRaw !== undefined) flags.only = onlyRaw;
  return flags;
}

function expandHome(p: string): string {
  return p.startsWith('~') ? path.join(process.env.HOME ?? '', p.slice(1)) : p;
}

function resolveSkillsAndAgents(sources: ReturnType<typeof scanClaudeSources>) {
  const resolvedSkills: SkillSource[] = [];
  const resolvedAgents: AgentSource[] = [];

  for (const name of config.skills) {
    const bareName = name.includes(':') ? (name.split(':')[1] as string) : name;
    const s = sources.skills.get(bareName);
    if (!s) {
      throw new Error(
        `skill '${name}' not found. Available: ${[...sources.skills.keys()].slice(0, 20).join(', ')}…`,
      );
    }
    resolvedSkills.push(s);
  }

  for (const name of config.agents) {
    const a = sources.agents.get(name);
    if (!a) {
      throw new Error(
        `agent '${name}' not found. Available: ${[...sources.agents.keys()].join(', ')}`,
      );
    }
    resolvedAgents.push(a);
  }

  return { resolvedSkills, resolvedAgents };
}

function detectCollisions(skills: SkillSource[], agents: AgentSource[]): Map<string, number> {
  const counts = new Map<string, number>();
  const allNames = [...skills.map((s) => s.name), ...agents.map((a) => a.name)];
  for (const n of allNames) counts.set(n, (counts.get(n) ?? 0) + 1);
  const collisions = new Map<string, number>();
  for (const [name, count] of counts) {
    if (count > 1) collisions.set(name, count);
  }
  return collisions;
}

function collectPortedNames(skills: SkillSource[], agents: AgentSource[]): PortedNames {
  const m: PortedNames = new Map();
  for (const s of skills) m.set(s.name, 'skill');
  for (const a of agents) m.set(a.name, 'agent');
  return m;
}

function writeOutput(out: TranslatorOutput, dryRun: boolean) {
  const full = path.resolve(process.cwd(), out.path);
  if (dryRun) {
    console.log(`[dry-run] would write ${out.path} (${out.content.length} bytes)`);
    return;
  }
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, out.content, 'utf8');
  console.log(`wrote ${out.path}`);
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const sources = scanClaudeSources();
  const { resolvedSkills, resolvedAgents } = resolveSkillsAndAgents(sources);

  // Pass 1 — collect ported names + detect collisions
  const portedNames = collectPortedNames(resolvedSkills, resolvedAgents);
  const collisions = detectCollisions(resolvedSkills, resolvedAgents);
  if (collisions.size > 0) {
    console.warn(
      `[warn] name collisions detected: ${[...collisions.keys()].join(', ')}. Using bare names; consider plugin prefixes in manifest.`,
    );
  }

  // Pass 2 — translate
  const outputs: TranslatorOutput[] = [];

  if (!flags.only || flags.only === 'instructions') {
    const projectClaudeMdPath = path.resolve(process.cwd(), config.instructions.projectClaudeMd);
    const projectClaudeMd = readFileSync(projectClaudeMdPath, 'utf8');
    outputs.push(
      claudemdToInstructions(projectClaudeMd, projectClaudeMdPath, portedNames, {
        target: 'project',
      }),
    );

    const globalPath = expandHome(config.instructions.globalClaudeMd);
    try {
      const globalContent = readFileSync(globalPath, 'utf8');
      outputs.push(
        claudemdToInstructions(globalContent, globalPath, portedNames, { target: 'user' }),
      );
    } catch (e) {
      console.warn(
        `[warn] global CLAUDE.md not readable at ${globalPath}: ${(e as Error).message}`,
      );
    }
  }

  if (!flags.only || flags.only === 'skills') {
    const rw = createRefRewriter(portedNames);
    for (const s of resolvedSkills) outputs.push(skillToPrompt(s, rw));
  }

  if (!flags.only || flags.only === 'agents') {
    const rw = createRefRewriter(portedNames);
    for (const a of resolvedAgents) {
      outputs.push(agentToChatmode(a));
      outputs.push(agentToPrompt(a, rw));
    }
  }

  if (!flags.only || flags.only === 'mcp') {
    const wanted = new Set(config.mcp);
    const selected = [...wanted].map((name) => {
      const src = sources.mcpServers.get(name);
      if (!src) {
        throw new Error(
          `MCP server '${name}' not found. Available: ${[...sources.mcpServers.keys()].join(', ')}`,
        );
      }
      return src;
    });
    outputs.push(mcpToVscode(selected));
  }

  for (const out of outputs) writeOutput(out, flags.dryRun);
}

main();
