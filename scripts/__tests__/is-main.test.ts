import { execFileSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const TSX = join(process.cwd(), 'node_modules/.bin/tsx');
const IS_MAIN = join(process.cwd(), 'scripts/lib/is-main.ts');
const MAIN_MARKER = 'is-main:true';
const IMPORTED_MARKER = 'is-main:false';

function fixture(): { dir: string; script: string } {
  const dir = mkdtempSync(join(tmpdir(), 'is-main-'));
  const script = join(dir, 'probe.ts');
  writeFileSync(
    script,
    `import { isMain } from ${JSON.stringify(IS_MAIN)};\nif (isMain(import.meta.url)) console.log('${MAIN_MARKER}');\nexport const probe = 1;\n`,
  );
  return { dir, script };
}

function run(entry: string, ...args: string[]): string {
  return execFileSync(TSX, [entry, ...args], { encoding: 'utf8', stdio: 'pipe' });
}

describe('isMain', () => {
  it('is true when the module is run directly', () => {
    expect(run(fixture().script)).toContain(MAIN_MARKER);
  });

  it('is true when the module is run through a symlink', () => {
    const { dir, script } = fixture();
    const link = join(dir, 'linked-probe.ts');
    symlinkSync(script, link);
    expect(run(link)).toContain(MAIN_MARKER);
  });

  it('is true when the module is run without its file extension', () => {
    const { script } = fixture();
    expect(run(script.replace(/\.ts$/, ''))).toContain(MAIN_MARKER);
  });

  it('is false when the module is imported by another entry', () => {
    const { dir, script } = fixture();
    const importer = join(dir, 'importer.ts');
    writeFileSync(
      importer,
      `import ${JSON.stringify(script)};\nconsole.log('${IMPORTED_MARKER}');\n`,
    );
    const out = run(importer);
    expect(out).toContain(IMPORTED_MARKER);
    expect(out).not.toContain(MAIN_MARKER);
  });

  it('is false when argv[1] is missing or does not exist', () => {
    const { dir, script } = fixture();
    const probe = join(dir, 'argv.ts');
    writeFileSync(
      probe,
      `import { isMain } from ${JSON.stringify(IS_MAIN)};\nprocess.argv[1] = process.argv[2] ?? '';\nconsole.log(String(isMain(${JSON.stringify(`file://${script}`)})));\n`,
    );
    expect(run(probe, join(dir, 'missing.ts')).trim()).toBe('false');
    expect(run(probe).trim()).toBe('false');
  });
});
