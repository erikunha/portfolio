import { describe, expect, it } from 'vitest';
import { productionSources } from '../helpers/production-sources';

const PRODUCTION_ROOTS = ['app', 'components', 'lib'];
const TIME_MODULE = 'lib/time.ts';
const UNMIGRATED_CONSUMERS: readonly string[] = [
  'components/ErrorPages/ErrorPages.client.tsx',
  'components/client/InteractiveShell/InteractiveShell.tsx',
  'components/client/InteractiveShell/useAskStream.ts',
];
const TIME_CONSTANT_DEFINITION =
  /^\s*(?:export )?const (MS_PER_SECOND|SECOND_MS|SECONDS_PER_MINUTE|SECONDS_PER_HOUR|MINUTES_PER_HOUR|HOURS_PER_DAY|MINUTES_PER_DAY|MS_PER_MINUTE|MS_PER_HOUR)\b/m;
const CLOCK_PAD_DEFINITION =
  /^\s*(?:export )?const (CLOCK_ZERO|CLOCK_DIGITS|CLOCK_PAD_LENGTH|CLOCK_PAD_CHAR|PAD_WIDTH)\b/m;

describe('time units and clock padding have one definition', () => {
  it('defines no time-unit constant outside lib/time.ts', () => {
    const offenders: string[] = [];
    for (const [file, text] of productionSources(PRODUCTION_ROOTS)) {
      if (file === TIME_MODULE || UNMIGRATED_CONSUMERS.includes(file)) continue;
      const hit = TIME_CONSTANT_DEFINITION.exec(text) ?? CLOCK_PAD_DEFINITION.exec(text);
      if (hit) offenders.push(`${file}: ${hit[1]}`);
    }
    expect(
      offenders,
      'a local copy of a time unit or the two-digit clock pad drifts from lib/time.ts; import it',
    ).toEqual([]);
  });
});
