#!/usr/bin/env tsx
/**
 * Meta-gate: verifies the enforcement layer itself is alive.
 *
 * Catches the "dead hook" class of rot: a hook that references a script which
 * no longer exists. The motivating case: css-token-guard.sh kept pointing at
 * scripts removed in the Tailwind v4 migration (2026-05-31). The hook then
 * silently no-ops (never fires, never false-fires), so nothing surfaces that
 * it broke. A gate you cannot tell is dead is worse than no gate.
 *
 * Checks:
 *  1. Every `scripts/<file>.{mjs,cjs,js,ts}` path referenced inside a
 *     .claude/hooks/*.sh file resolves on disk.
 *  2. Every hook command wired in .claude/settings.json points to a file
 *     that exists.
 *
 * Exit 1 (with the dead-reference list) on any miss; exit 0 when clean.
 */
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

/**
 * Extract the unique `scripts/...` code paths a hook actually invokes.
 * Shell comments are stripped first so a history note naming a deleted script
 * does not count as a live reference (which would false-positive the gate on
 * its own documentation).
 */
export function collectScriptRefs(content: string): string[] {
  const code = content
    .split('\n')
    .map((line) => line.replace(/(?:^|\s)#.*$/, ''))
    .join('\n');
  return [...new Set(code.match(SCRIPT_REF) ?? [])];
}

/** Walk settings.json hooks.*[].hooks[].command and collect .claude/hooks/*.sh refs. */
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
