#!/usr/bin/env tsx
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_REF = /\bscripts\/[A-Za-z0-9_./-]+\.(?:mjs|cjs|js|ts)\b/g;
const HOOK_REF = /\.claude\/hooks\/[A-Za-z0-9_./-]+\.sh\b/g;
const SETTINGS_PATH = '.claude/settings.json';

interface SettingsShape {
  hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>>;
}

export interface DeadRef {
  source: string;
  ref: string;
  kind: 'hook->script' | 'settings->hook' | 'hook->unwired';
}

export interface HookFile {
  name: string;
  refs: string[];
  hookRefs?: string[];
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
  const wired = new Set([...settingsRefs, ...hookFiles.flatMap((f) => f.hookRefs ?? [])]);
  for (const { name } of hookFiles) {
    if (!wired.has(name)) {
      dead.push({ source: name, ref: SETTINGS_PATH, kind: 'hook->unwired' });
    }
  }
  return dead;
}

function main(): void {
  const root = process.cwd();
  const hooksDir = join(root, '.claude/hooks');
  const hookFiles: HookFile[] = existsSync(hooksDir)
    ? readdirSync(hooksDir)
        .filter((f) => f.endsWith('.sh'))
        .map((f) => {
          const content = readFileSync(join(hooksDir, f), 'utf8');
          return {
            name: `.claude/hooks/${f}`,
            refs: collectScriptRefs(content),
            hookRefs: [...new Set(content.match(HOOK_REF) ?? [])],
          };
        })
    : [];

  const settingsPath = join(root, SETTINGS_PATH);
  const settingsRefs = existsSync(settingsPath)
    ? collectSettingsHookPaths(JSON.parse(readFileSync(settingsPath, 'utf8')) as SettingsShape)
    : [];

  const exists = (rel: string): boolean => existsSync(resolve(root, rel));
  const dead = auditGates({ hookFiles, settingsRefs, exists });

  if (dead.length > 0) {
    console.error(`[gate-health] ${dead.length} dead gate reference(s):`);
    for (const d of dead) {
      const detail =
        d.kind === 'hook->unwired' ? 'hook file exists but nothing wires it' : 'file missing';
      console.error(`  ✗ ${d.source} → ${d.ref} (${d.kind}: ${detail})`);
    }
    console.error('Fix: restore the script, wire or delete the hook, or repoint the reference.');
    process.exit(1);
  }
  console.log('[gate-health] all hook and settings references resolve, and every hook is wired.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
