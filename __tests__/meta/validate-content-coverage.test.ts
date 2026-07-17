import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listContentFiles } from '../../scripts/content-files.mjs';

const CONTENT_DIR = join(process.cwd(), 'content');

let probeRoot: string;

beforeEach(() => {
  probeRoot = mkdtempSync(join(tmpdir(), 'content-probe-'));
});
afterEach(() => {
  rmSync(probeRoot, { recursive: true, force: true });
});

describe('validate-content covers every content module', () => {
  it('includes the _-prefixed build-time aggregator', () => {
    expect(
      listContentFiles(),
      'content/_validate-client-content.ts is the ONLY module that parses DmesgLineSchema, ShellCommandsSchema, and TerminalChromeSchema — their own modules deliberately carry zero .parse() calls, because a parse at module init would ship zod to the client bundle. Excluding _-prefixed files here (as __tests__/helpers/content-surfaces.ts correctly does for its OWN purpose) drops three schemas from the build gate while the gate still prints green.',
    ).toContain(join(CONTENT_DIR, '_validate-client-content.ts'));
  });

  it('excludes schema definitions and tests', () => {
    const files = listContentFiles();
    expect(files).not.toContain(join(CONTENT_DIR, 'schemas.ts'));
    expect(files.filter((file) => file.includes('.test.'))).toEqual([]);
  });

  it('picks up a nested module without the gate being edited', () => {
    mkdirSync(join(probeRoot, 'nested'), { recursive: true });
    writeFileSync(join(probeRoot, 'nested/probe.ts'), 'export const probe = 1;\n');
    writeFileSync(join(probeRoot, 'schemas.ts'), 'export const s = 1;\n');
    writeFileSync(join(probeRoot, 'probe.test.ts'), 'export const t = 1;\n');
    writeFileSync(join(probeRoot, '_infra.ts'), 'export const i = 1;\n');

    const found = listContentFiles(probeRoot);

    expect(
      found,
      'a content module nested in a subdirectory must be picked up by the glob without anyone editing the gate. This is the fail-open the old 22-entry CONTENT_FILES hand-list produced: an unlisted content file was never Zod-parsed and validate-content still printed green.',
    ).toContain(join(probeRoot, 'nested/probe.ts'));
    expect(found).toContain(join(probeRoot, '_infra.ts'));
    expect(found).not.toContain(join(probeRoot, 'schemas.ts'));
    expect(found).not.toContain(join(probeRoot, 'probe.test.ts'));
  });
});
