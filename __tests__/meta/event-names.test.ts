import { describe, expect, it } from 'vitest';
import * as events from '@/lib/events';
import { productionSources } from '../helpers/production-sources';

const PRODUCTION_ROOTS = ['app', 'components', 'lib'];
const REGISTRY_FILE = 'lib/events.ts';
const UNMIGRATED_CONSUMERS: readonly string[] = [];

const EVENT_CONSTANTS = [
  'SYSFAIL_START',
  'SYSFAIL_END',
  'SHELL_COMMAND_EVENT',
  'HERO_SYSFAIL_SHOW',
  'HERO_SYSFAIL_HIDE',
] as const;

describe('window event names have one definition', () => {
  it('exports a constant for every event the app dispatches or listens for', () => {
    for (const name of EVENT_CONSTANTS) {
      expect(typeof (events as Record<string, unknown>)[name], `${name} is exported`).toBe(
        'string',
      );
    }
  });

  it('keeps every event name literal inside lib/events.ts', () => {
    const literals = EVENT_CONSTANTS.map(
      (name) => (events as Record<string, unknown>)[name],
    ).filter((literal): literal is string => typeof literal === 'string');
    const offenders: string[] = [];
    for (const [file, text] of productionSources(PRODUCTION_ROOTS)) {
      if (file === REGISTRY_FILE || UNMIGRATED_CONSUMERS.includes(file)) continue;
      for (const literal of literals) {
        if (new RegExp(`['"\`]${literal}['"\`]`).test(text)) offenders.push(`${file}: ${literal}`);
      }
    }
    expect(
      offenders,
      'a bare event-name string bypasses the typed WindowEventMap and the rename check; import the constant from @/lib/events',
    ).toEqual([]);
  });
});
