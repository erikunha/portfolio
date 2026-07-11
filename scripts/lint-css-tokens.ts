#!/usr/bin/env tsx
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;

export interface HexHit {
  line: number;
  hex: string;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

export function findRawHex(css: string): HexHit[] {
  const out: HexHit[] = [];
  stripComments(css)
    .split('\n')
    .forEach((line, i) => {
      for (const match of line.matchAll(HEX)) {
        out.push({ line: i + 1, hex: match[0] });
      }
    });
  return out;
}

export function assertScannable(
  dirExists: boolean,
  files: string[],
): { ok: true } | { ok: false; reason: string } {
  if (!dirExists) return { ok: false, reason: 'app/css/ does not exist' };
  if (files.length === 0) {
    return { ok: false, reason: 'app/css/ has no .css files (besides theme.css) to scan' };
  }
  return { ok: true };
}

function main(): void {
  const root = process.cwd();
  const cssDir = join(root, 'app/css');
  const dirExists = existsSync(cssDir);
  const files = dirExists
    ? readdirSync(cssDir).filter((f) => f.endsWith('.css') && f !== 'theme.css')
    : [];

  const scannable = assertScannable(dirExists, files);
  if (!scannable.ok) {
    console.error(
      `[css-tokens] GATE ERROR: ${scannable.reason}; the token-boundary gate cannot run. Refusing to pass vacuously.`,
    );
    process.exit(2);
  }

  const violations: string[] = [];
  for (const file of files) {
    const rel = `app/css/${file}`;
    for (const { line, hex } of findRawHex(readFileSync(join(cssDir, file), 'utf8'))) {
      violations.push(`${rel}:${line}: ${hex}`);
    }
  }

  if (violations.length > 0) {
    console.error(`[css-tokens] ${violations.length} raw hex literal(s) outside theme.css:`);
    for (const v of violations) console.error(`  ✗ ${v}`);
    console.error('Brand colors live in app/css/theme.css; reference them via var(--color-...).');
    process.exit(1);
  }
  console.log('[css-tokens] no raw hex outside theme.css.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
