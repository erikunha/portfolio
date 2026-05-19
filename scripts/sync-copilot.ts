#!/usr/bin/env tsx
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config } from './copilot-port.config';
import { scanClaudeSources } from './lib/copilot/sources';
import { claudemdToInstructions } from './lib/copilot/translators/claudemd-to-instructions';
import type { PortedNames, TranslatorOutput } from './lib/copilot/types';

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

function collectPortedNames(): PortedNames {
  // PR-1: only CLAUDE.md is being ported; portedNames is empty for now.
  // Filled in PR-3 when skills/agents land.
  return new Map();
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
  const _sources = scanClaudeSources();
  const portedNames = collectPortedNames();

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

  for (const out of outputs) writeOutput(out, flags.dryRun);
}

main();
