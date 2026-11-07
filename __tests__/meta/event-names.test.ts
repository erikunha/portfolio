import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as events from '@/lib/events';

const ROOT_DIR = process.cwd();
const PRODUCTION_ROOTS = ['app', 'components', 'lib'];
const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const NOT_PRODUCTION = /\.(test|spec|e2e)\.[cm]?[jt]sx?$|\/__tests__\//;
const REGISTRY_FILE = 'lib/events.ts';
const UNMIGRATED_CONSUMERS: readonly string[] = [
  'components/client/InteractiveShell/InteractiveShell.tsx',
];

const EVENT_CONSTANTS = [
  'SYSFAIL_START',
  'SYSFAIL_END',
  'SHELL_COMMAND_EVENT',
  'HERO_SYSFAIL_SHOW',
  'HERO_SYSFAIL_HIDE',
] as const;

function productionFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return productionFiles(path);
    return SOURCE_FILE.test(entry.name) && !NOT_PRODUCTION.test(path) ? [path] : [];
  });
}

describe('window event names have one definition', () => {
  it('exports a constant for every event the app dispatches or listens for', () => {
    for (const name of EVENT_CONSTANTS) {
      expect(typeof (events as Record<string, unknown>)[name], `${name} is exported`).toBe(
        'string',
      );
    }
  });

  it('keeps every event name literal inside lib/events.ts', () => {
    const literals = EVENT_CONSTANTS.map((name) => (events as Record<string, string>)[name]).filter(
      (literal): literal is string => typeof literal === 'string',
    );
    const offenders: string[] = [];
    for (const root of PRODUCTION_ROOTS) {
      for (const file of productionFiles(join(ROOT_DIR, root))) {
        const rel = relative(ROOT_DIR, file);
        if (rel === REGISTRY_FILE || UNMIGRATED_CONSUMERS.includes(rel)) continue;
        // behavioral-test-allow: a bare event-name literal is invisible to the typed WindowEventMap, so the source is the property under test
        const text = readFileSync(file, 'utf-8');
        for (const literal of literals) {
          if (new RegExp(`['"\`]${literal}['"\`]`).test(text)) offenders.push(`${rel}: ${literal}`);
        }
      }
    }
    expect(
      offenders,
      'a bare event-name string bypasses the typed WindowEventMap and the rename check; import the constant from @/lib/events',
    ).toEqual([]);
  });
});
