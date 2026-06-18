#!/usr/bin/env tsx
/**
 * Bans raw hex color literals in global CSS outside app/css/theme.css.
 *
 * STANDARDS Ch.7: all brand colors live in app/css/theme.css under @theme as
 * the single source of truth; every other CSS file must reference a token via
 * `var(--color-...)`. A raw `#hex` elsewhere is palette drift.
 *
 * Replaces the pre-Tailwind-v4 lint-token-boundary / lint-no-magic-values pair
 * removed in the 2026-05-31 migration. The css-token-guard.sh hook kept
 * pointing at those deleted scripts and silently no-opped until the gate-health
 * meta-gate surfaced it (2026-06-17).
 *
 * Exit 1 (with file:line:hex list) on any violation; exit 0 when clean.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Valid CSS hex color lengths only (3/4/6/8), bounded so #12345 is not a hit.
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;

export interface HexHit {
  line: number;
  hex: string;
}

/** Blank out block-comment contents while preserving newlines (so line numbers hold). */
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

function main(): void {
  const root = process.cwd();
  const cssDir = join(root, 'app/css');
  const files = existsSync(cssDir)
    ? readdirSync(cssDir).filter((f) => f.endsWith('.css') && f !== 'theme.css')
    : [];

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
