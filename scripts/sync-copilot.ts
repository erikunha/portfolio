#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config } from './copilot-port.config';
import { createRefRewriter } from './lib/copilot/refs';
import { scanClaudeSources } from './lib/copilot/sources';
import { agentToChatmode } from './lib/copilot/translators/agent-to-chatmode';
import { agentToPrompt } from './lib/copilot/translators/agent-to-prompt';
import { applyToToInstructions } from './lib/copilot/translators/applyto-to-instructions';
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

function collectPortedNames(skills: SkillSource[], agents: AgentSource[]): PortedNames {
  const m: PortedNames = new Map();
  for (const s of skills) {
    if (m.has(s.name)) {
      throw new Error(
        `name collision: skill '${s.name}' conflicts with an agent of the same name. Use plugin-prefixed names in the manifest to disambiguate.`,
      );
    }
    m.set(s.name, 'skill');
  }
  for (const a of agents) {
    if (m.has(a.name)) {
      throw new Error(
        `name collision: agent '${a.name}' conflicts with a skill of the same name. Use plugin-prefixed names in the manifest to disambiguate.`,
      );
    }
    m.set(a.name, 'agent');
  }
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

  // Pass 1 — collect ported names (throws on skill/agent name collision)
  const portedNames = collectPortedNames(resolvedSkills, resolvedAgents);

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

  if (!flags.only || flags.only === 'applyto') {
    for (const entry of config.instructions.applyTo) {
      outputs.push(applyToToInstructions(entry, sources));
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

  // JSON outputs: JSON.stringify multi-lines arrays unconditionally, but
  // biome's JSON formatter prefers short arrays inline. Without this pass,
  // every `pnpm sync:copilot` would leave the tree failing `pnpm check`.
  // Biome stays the source of truth for formatting; the generator only
  // owns content. execFileSync avoids shell interpolation.
  if (!flags.dryRun) {
    const jsonPaths = outputs.filter((o) => o.path.endsWith('.json')).map((o) => o.path);
    if (jsonPaths.length > 0) {
      execFileSync('pnpm', ['exec', 'biome', 'format', '--write', ...jsonPaths], {
        stdio: 'inherit',
      });
    }
  }
}

main();
