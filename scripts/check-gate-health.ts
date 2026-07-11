#!/usr/bin/env tsx
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_REF = /\bscripts\/[A-Za-z0-9_./-]+\.(?:mjs|cjs|js|ts)\b/g;
const HOOK_REF = /\.claude\/hooks\/[A-Za-z0-9_./-]+\.sh\b/g;

interface SettingsShape {
  hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>>;
}

export interface DeadRef {
  source: string;
  ref: string;
  kind: 'hook->script' | 'settings->hook';
}

export interface HookFile {
  name: string;
  refs: string[];
}

export function collectScriptRefs(content: string): string[] {
  const code = content
    .split('\n')
    .map((line) => line.replace(/(?:^|\s)#.*$/, ''))
    .join('\n');
  return [...new Set(code.match(SCRIPT_REF) ?? [])];
}

export function collectSettingsHookPaths(settings: SettingsShape): string[] {
  const out = new Set<string>();
  for (const matchers of Object.values(settings?.hooks ?? {})) {
    for (const matcher of matchers ?? []) {
      for (const hook of matcher?.hooks ?? []) {
        for (const ref of (hook?.command ?? '').match(HOOK_REF) ?? []) {
          out.add(ref);
        }
      }
    }
  }
  return [...out];
}

export function auditGates(input: {
  hookFiles: HookFile[];
  settingsRefs: string[];
  exists: (rel: string) => boolean;
}): DeadRef[] {
  const { hookFiles, settingsRefs, exists } = input;
  const dead: DeadRef[] = [];
  for (const { name, refs } of hookFiles) {
    for (const ref of refs) {
      if (!exists(ref)) dead.push({ source: name, ref, kind: 'hook->script' });
    }
  }
  for (const ref of settingsRefs) {
    if (!exists(ref)) dead.push({ source: '.claude/settings.json', ref, kind: 'settings->hook' });
  }
  return dead;
}

function main(): void {
  const root = process.cwd();
  const hooksDir = join(root, '.claude/hooks');
  const hookFiles: HookFile[] = existsSync(hooksDir)
    ? readdirSync(hooksDir)
        .filter((f) => f.endsWith('.sh'))
        .map((f) => ({
          name: `.claude/hooks/${f}`,
          refs: collectScriptRefs(readFileSync(join(hooksDir, f), 'utf8')),
        }))
    : [];

  const settingsPath = join(root, '.claude/settings.json');
  const settingsRefs = existsSync(settingsPath)
    ? collectSettingsHookPaths(JSON.parse(readFileSync(settingsPath, 'utf8')) as SettingsShape)
    : [];

  const exists = (rel: string): boolean => existsSync(resolve(root, rel));
  const dead = auditGates({ hookFiles, settingsRefs, exists });

  if (dead.length > 0) {
    console.error(`[gate-health] ${dead.length} dead gate reference(s):`);
    for (const d of dead) console.error(`  ✗ ${d.source} → ${d.ref} (${d.kind}: file missing)`);
    console.error('Fix: restore the script, repoint the hook, or remove the dead hook.');
    process.exit(1);
  }
  console.log('[gate-health] all hook and settings references resolve.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
