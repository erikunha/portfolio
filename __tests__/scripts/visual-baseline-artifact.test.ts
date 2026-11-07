import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ci = readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8');

const uploadStep = ci.slice(ci.indexOf('name: Upload regenerated visual baselines'));
const pathLine = uploadStep.match(/^\s*path:\s*(.+)$/m)?.[1]?.trim() ?? '';

describe('ci.yml regenerated visual baselines artifact', () => {
  it('uploads only the running project linux baselines, so artifacts never carry stale copies of another project', () => {
    expect(
      pathLine,
      'a whole-directory upload ships every project baseline; copying two artifacts in sequence lets the stale copy in the second overwrite the fresh one in the first',
    ).toBe('tests/visual/visual.spec.ts-snapshots/*-${{ matrix.project }}-linux.png');
  });
});
