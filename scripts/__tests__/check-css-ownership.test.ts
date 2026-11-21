import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;
const CSS_DIR = 'app/css';
const OWNER = `${CSS_DIR}/components-hero.css`;
const OTHER = `${CSS_DIR}/animations.css`;

const SCRIPT = path.resolve('scripts/gates/check-css-ownership.ts');
const NODE_MODULES = path.resolve('node_modules');
const roots: string[] = [];

function run(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), 'css-ownership-'));
  roots.push(root);
  mkdirSync(path.join(root, 'scripts/gates'), { recursive: true });
  symlinkSync(NODE_MODULES, path.join(root, 'node_modules'));
  const copy = path.join(root, 'scripts/gates/check-css-ownership.ts');
  copyFileSync(SCRIPT, copy);
  mkdirSync(path.join(root, CSS_DIR), { recursive: true });
  for (const [rel, source] of Object.entries(files)) {
    writeFileSync(path.join(root, rel), source);
  }
  return spawnSync('node', [copy], { encoding: 'utf-8' });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('check-css-ownership', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  it('passes hero rules in the owner and non-hero rules elsewhere', () => {
    const result = run({
      [OWNER]: '.hero-boot { color: red; }\n',
      [OTHER]: '.footer { color: red; }\n',
    });
    expect(result.status).toBe(0);
  });

  it('fails a hero rule outside the owner and names file and selector', () => {
    const result = run({ [OTHER]: '.a,\n.hero-x   .b { color: red; }\n' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${OTHER}: .a, .hero-x .b`);
  });

  it('fails a hero rule nested inside a media query', () => {
    const result = run({ [OTHER]: '@media (min-width: 40rem) { .hero-x { color: red; } }\n' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.hero-x');
  });

  it('allows hero keyframes, vendor-prefixed ones included, outside the owner', () => {
    const result = run({
      [OTHER]:
        '@keyframes hero-blink { from { opacity: 0; } to { opacity: 1; } }\n@-webkit-keyframes hero-blink { 0% { opacity: 0; } }\n',
    });
    expect(result.status).toBe(0);
  });

  it('ignores a hero selector inside a comment', () => {
    const result = run({ [OTHER]: '/* .hero-x { color: red; } */\n.a { color: red; }\n' });
    expect(result.status).toBe(0);
  });

  it('ignores a hero name in a declaration value', () => {
    const result = run({ [OTHER]: '.a { animation-name: hero-blink; }\n' });
    expect(result.status).toBe(0);
  });
});
