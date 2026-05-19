import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { claudemdToInstructions } from '@/scripts/lib/copilot/translators/claudemd-to-instructions';
import type { PortedNames } from '@/scripts/lib/copilot/types';
import { fixtureManifest } from './fixtures/manifest';

describe('snapshot: full-pipeline output (PR-1 surface)', () => {
  it('claudemd → copilot-instructions.md matches snapshot', () => {
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
});
