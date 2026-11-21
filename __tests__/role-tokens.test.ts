// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Root } from 'postcss';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { compiledStylesheet } from './helpers/css-rules';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;
const SCRIPT = path.join(process.cwd(), 'scripts/gates/contrast-check.ts');
const PRIMITIVE_REFERENCE = /^var\(--color-((?:signal|sage|carbon|gold|coral)-\w+)\)$/;
const PRINT_REFERENCE = /^var\(--color-print-(?:ink|paper|rule)\)$/;
const PRINT_MEDIA = /^print$/;

const ROLES = [
  'surface',
  'surface-raised',
  'border',
  'border-strong',
  'accent',
  'on-accent',
  'text',
  'text-muted',
  'focus',
  'warning',
  'danger',
  'scrim',
];

const ROLE_PAIR_LABELS = [
  'role text on surface',
  'role text-muted on surface',
  'role on-accent on accent',
  'role accent on surface',
  'role focus on surface',
  'role warning on surface',
  'role danger on surface',
];

function rootDeclarations(root: Root, inPrint: boolean): Map<string, string> {
  const found = new Map<string, string>();
  root.walkRules((rule) => {
    if (!rule.selectors.includes(':root')) return;
    let printed = false;
    for (let up = rule.parent; up && up.type !== 'root'; up = up.parent) {
      if (up.type === 'atrule' && 'name' in up && up.name === 'media') {
        printed = PRINT_MEDIA.test((up as { params: string }).params.trim());
      }
    }
    if (printed !== inPrint) return;
    rule.walkDecls(/^--color-/, (decl) => {
      found.set(decl.prop.replace('--color-', ''), decl.value);
    });
  });
  return found;
}

describe('role tokens in the compiled stylesheet', () => {
  let screen: Map<string, string>;
  let print: Map<string, string>;

  beforeAll(async () => {
    const root = await compiledStylesheet('globals');
    screen = rootDeclarations(root, false);
    print = rootDeclarations(root, true);
  });

  it.each(ROLES)('--color-%s aliases a declared primitive', (role) => {
    const value = screen.get(role);
    expect(value, `--color-${role} missing from the compiled :root`).toBeDefined();
    const primitive = value?.match(PRIMITIVE_REFERENCE)?.[1];
    expect(primitive, `--color-${role} is ${value}, not a primitive reference`).toBeDefined();
    expect(screen.has(primitive ?? ''), `--color-${primitive} is not declared`).toBe(true);
  });

  it.each(ROLES)('--color-%s is remapped inside @media print', (role) => {
    expect(print.get(role)).toMatch(PRINT_REFERENCE);
  });
});

describe('role contrast audit', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'roles-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('passes on the shipped theme and reports every role pair', () => {
    const result = spawnSync('node', [SCRIPT], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    for (const label of ROLE_PAIR_LABELS) expect(result.stdout).toContain(label);
  });

  it('fails a theme that declares some roles but omits one', () => {
    const theme = path.join(dir, 'theme.css');
    const declared = ROLES.filter((role) => role !== 'scrim' && role !== 'text');
    writeFileSync(
      theme,
      `@theme {\n${PALETTE}\n--color-text: var(--color-sage-50);\n${declared
        .map((role) => `--color-${role}: var(--color-${ROLE_TARGETS[role]});`)
        .join('\n')}\n}\n`,
    );
    const result = spawnSync('node', [SCRIPT, theme], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--color-scrim not declared');
  });
});

const PALETTE = `
  --color-carbon-950: #000000;
  --color-carbon-900: #050505;
  --color-sage-50: #e6ffe6;
  --color-sage-400: #8a9d8a;
  --color-sage-500: #6b7c6b;
  --color-coral-300: #ff8a8a;
  --color-coral-500: #ff5f57;
  --color-gold-500: #febc2e;
  --color-signal-300: #5ae07b;
  --color-signal-400: #4ade80;
  --color-signal-500: #00ff41;
  --color-signal-700: #1e9b32;
  --color-signal-border: #00ff4133;
  --color-signal-subtle: #00ff4166;
  --color-text-secondary: #a1b3a1;
`;

const ROLE_TARGETS: Record<string, string> = {
  surface: 'carbon-950',
  'surface-raised': 'carbon-900',
  border: 'signal-border',
  'border-strong': 'signal-subtle',
  accent: 'signal-500',
  'on-accent': 'carbon-950',
  'text-muted': 'sage-400',
  focus: 'signal-500',
  warning: 'gold-500',
  danger: 'coral-500',
};
