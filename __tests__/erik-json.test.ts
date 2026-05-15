import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
  path.resolve(__dirname, '../app/api/erik.json/route.ts'),
  'utf-8',
);

describe('/api/erik.json route', () => {
  it('exports a GET handler', () => {
    expect(SOURCE).toContain('export async function GET');
  });

  it('returns @type HiringProfile', () => {
    expect(SOURCE).toContain('"@type"');
    expect(SOURCE).toContain('HiringProfile');
  });

  it('includes availability field', () => {
    expect(SOURCE).toContain('availability');
  });

  it('includes stack_primary field', () => {
    expect(SOURCE).toContain('stack_primary');
  });

  it('includes work_auth field', () => {
    expect(SOURCE).toContain('work_auth');
  });

  it('sets a long-lived cache header', () => {
    expect(SOURCE).toContain('max-age');
  });
});
