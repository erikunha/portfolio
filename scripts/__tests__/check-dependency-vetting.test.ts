import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findViolations,
  type InstalledPackage,
  normalizeLicense,
  type VettingInput,
} from '../check-dependency-vetting';

const SCRIPT = join(process.cwd(), 'scripts/check-dependency-vetting.ts');
const TSX = join(process.cwd(), 'node_modules/.bin/tsx');
const CLEAN_INSTALL: InstalledPackage = { license: 'MIT', installScripts: [] };

function input(overrides: Partial<VettingInput> = {}): VettingInput {
  return {
    manifest: { dependencies: { clsx: '^2.1.1' }, devDependencies: { vitest: '^5.1.0' } },
    vetting: {
      clsx: { purpose: 'joins class names', license: 'MIT' },
      vitest: { purpose: 'unit test runner', license: 'MIT' },
    },
    installed: { clsx: CLEAN_INSTALL, vitest: CLEAN_INSTALL },
    ...overrides,
  };
}

describe('findViolations', () => {
  it('passes when every direct dependency is vetted, installed and script-free', () => {
    expect(findViolations(input())).toEqual([]);
  });

  it('fails a dependency that has no entry', () => {
    const base = input();
    const { clsx: _removed, ...vetting } = base.vetting;
    expect(findViolations({ ...base, vetting })).toEqual([expect.stringContaining('clsx')]);
    expect(findViolations({ ...base, vetting })[0]).toMatch(/no entry/);
  });

  it('fails a devDependency that has no entry', () => {
    const base = input();
    const { vitest: _removed, ...vetting } = base.vetting;
    const violations = findViolations({ ...base, vetting });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/vitest.*no entry/);
  });

  it('fails an optionalDependency that has no entry', () => {
    const violations = findViolations(
      input({
        manifest: { optionalDependencies: { fsevents: '^2.3.3' } },
        vetting: {},
        installed: { fsevents: CLEAN_INSTALL },
      }),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/fsevents.*no entry/);
  });

  it('fails an entry whose package left package.json', () => {
    const base = input();
    const violations = findViolations({
      ...base,
      vetting: { ...base.vetting, 'left-pad': { purpose: 'pads strings', license: 'MIT' } },
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/left-pad.*not a direct dependency/);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['whitespace only', '   '],
    ['not a string', 42],
  ])('fails an entry whose purpose is %s', (_label, purpose) => {
    const violations = findViolations(
      input({
        vetting: {
          clsx: { purpose, license: 'MIT' },
          vitest: { purpose: 'unit test runner', license: 'MIT' },
        },
      }),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/clsx.*purpose/);
  });

  it('fails an entry that records no license', () => {
    const violations = findViolations(
      input({
        vetting: {
          clsx: { purpose: 'joins class names' },
          vitest: { purpose: 'unit test runner', license: 'MIT' },
        },
      }),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/clsx.*records no license/);
  });

  it('fails when the installed license differs from the recorded one, naming both', () => {
    const violations = findViolations(
      input({
        installed: { clsx: { license: 'GPL-3.0', installScripts: [] }, vitest: CLEAN_INSTALL },
      }),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/clsx/);
    expect(violations[0]).toContain('GPL-3.0');
    expect(violations[0]).toContain('MIT');
  });

  it('fails when the installed package declares no license', () => {
    const violations = findViolations(
      input({ installed: { clsx: { license: null, installScripts: [] }, vitest: CLEAN_INSTALL } }),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/clsx.*no license/);
  });

  it('fails a direct dependency that is not installed, rather than skipping its checks', () => {
    const violations = findViolations(input({ installed: { vitest: CLEAN_INSTALL } }));
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/clsx.*not installed/);
  });

  it.each(['preinstall', 'install', 'postinstall'])(
    'fails a %s script on a package outside pnpm.onlyBuiltDependencies',
    (script) => {
      const violations = findViolations(
        input({
          installed: {
            clsx: { license: 'MIT', installScripts: [script] },
            vitest: CLEAN_INSTALL,
          },
        }),
      );
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatch(/clsx/);
      expect(violations[0]).toContain(script);
      expect(violations[0]).toMatch(/onlyBuiltDependencies/);
    },
  );

  it('allows an install script on a package listed in pnpm.onlyBuiltDependencies', () => {
    const base = input();
    expect(
      findViolations({
        ...base,
        manifest: { ...base.manifest, pnpm: { onlyBuiltDependencies: ['clsx'] } },
        installed: {
          clsx: { license: 'MIT', installScripts: ['postinstall'] },
          vitest: CLEAN_INSTALL,
        },
      }),
    ).toEqual([]);
  });

  it('reports every problem in one run so a single pass lists all of them', () => {
    const violations = findViolations(
      input({
        vetting: {
          vitest: { purpose: '', license: 'MIT' },
          ghost: { purpose: 'x', license: 'MIT' },
        },
        installed: { clsx: CLEAN_INSTALL, vitest: CLEAN_INSTALL },
      }),
    );
    expect(violations).toHaveLength(3);
  });
});

describe('normalizeLicense', () => {
  it('reads the SPDX string', () => {
    expect(normalizeLicense({ license: 'MIT OR Apache-2.0' })).toBe('MIT OR Apache-2.0');
  });

  it('reads the legacy { type } object', () => {
    expect(normalizeLicense({ license: { type: 'BSD-3-Clause', url: 'x' } })).toBe('BSD-3-Clause');
  });

  it('joins the legacy licenses array so a dual license is one comparable value', () => {
    expect(normalizeLicense({ licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] })).toBe(
      'MIT OR Apache-2.0',
    );
  });

  it('skips a legacy licenses entry that has no type instead of recording a blank', () => {
    expect(normalizeLicense({ licenses: [{ type: 'MIT' }, {}] })).toBe('MIT');
  });

  it.each([{}, { license: '' }, { license: 7 }, { licenses: [] }])(
    'returns null when no license is declared (%j)',
    (pkg) => {
      expect(normalizeLicense(pkg)).toBeNull();
    },
  );
});

interface Fixture {
  manifest?: object;
  vetting?: object | string | null;
  installed?: Record<string, object>;
}

function runOn(fixture: Fixture): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'depvet-'));
  const write = (rel: string, body: string) => {
    const file = join(dir, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
  };
  write('package.json', JSON.stringify(fixture.manifest ?? {}));
  if (fixture.vetting !== null) {
    write(
      'dependency-vetting.json',
      typeof fixture.vetting === 'string' ? fixture.vetting : JSON.stringify(fixture.vetting ?? {}),
    );
  }
  for (const [name, pkg] of Object.entries(fixture.installed ?? {})) {
    write(join('node_modules', name, 'package.json'), JSON.stringify(pkg));
  }
  try {
    const out = execFileSync(TSX, [SCRIPT, dir], { encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
}

const CLSX_MANIFEST = { dependencies: { clsx: '^2.1.1' } };
const CLSX_VETTING = { clsx: { purpose: 'joins class names', license: 'MIT' } };

describe('check-dependency-vetting (process)', () => {
  it('exits 0 and reports success on a vetted tree', () => {
    const r = runOn({
      manifest: CLSX_MANIFEST,
      vetting: CLSX_VETTING,
      installed: { clsx: { name: 'clsx', license: 'MIT' } },
    });
    expect(r.code).toBe(0);
    expect(r.out).toContain('0 violations');
  });

  it('exits 1 and names the package when a dependency is unvetted', () => {
    const r = runOn({
      manifest: CLSX_MANIFEST,
      vetting: {},
      installed: { clsx: { name: 'clsx', license: 'MIT' } },
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain('clsx');
  });

  it.each(['preinstall', 'install', 'postinstall'])(
    'exits 1 when an installed package gained a %s script',
    (script) => {
      const r = runOn({
        manifest: CLSX_MANIFEST,
        vetting: CLSX_VETTING,
        installed: { clsx: { name: 'clsx', license: 'MIT', scripts: { [script]: 'node x.js' } } },
      });
      expect(r.code).toBe(1);
      expect(r.out).toContain(script);
    },
  );

  it('ignores lifecycle scripts that do not run on install', () => {
    const r = runOn({
      manifest: CLSX_MANIFEST,
      vetting: CLSX_VETTING,
      installed: {
        clsx: { name: 'clsx', license: 'MIT', scripts: { prepare: 'husky', test: 'vitest' } },
      },
    });
    expect(r.code).toBe(0);
  });

  it('allows an install script once the package is listed in pnpm.onlyBuiltDependencies', () => {
    const r = runOn({
      manifest: { ...CLSX_MANIFEST, pnpm: { onlyBuiltDependencies: ['clsx'] } },
      vetting: CLSX_VETTING,
      installed: { clsx: { name: 'clsx', license: 'MIT', scripts: { postinstall: 'node x.js' } } },
    });
    expect(r.code).toBe(0);
  });

  it('exits 1 when the installed license changed since vetting', () => {
    const r = runOn({
      manifest: CLSX_MANIFEST,
      vetting: CLSX_VETTING,
      installed: { clsx: { name: 'clsx', license: 'AGPL-3.0' } },
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain('AGPL-3.0');
  });

  it('exits 1 when the dependency is not installed', () => {
    const r = runOn({ manifest: CLSX_MANIFEST, vetting: CLSX_VETTING, installed: {} });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/not installed/);
  });

  it('exits 2, not 0, when dependency-vetting.json is missing', () => {
    const r = runOn({ manifest: CLSX_MANIFEST, vetting: null });
    expect(r.code).toBe(2);
    expect(r.out).toContain('dependency-vetting.json');
  });

  it('exits 2, not 0, when dependency-vetting.json is not valid JSON', () => {
    const r = runOn({ manifest: CLSX_MANIFEST, vetting: '{not json' });
    expect(r.code).toBe(2);
    expect(r.out).toContain('dependency-vetting.json');
  });
});
