import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const CSS_IGNORE = ['node_modules/**', '.next/**', '.claude/**', 'design-system/dist/**'];

export function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));
}

export async function scanCssModules() {
  const files = await Array.fromAsync(glob('**/*.module.css', { cwd: ROOT, ignore: CSS_IGNORE }));
  return files.sort().map((rel) => {
    const abs = path.join(ROOT, rel);
    const raw = readFileSync(abs, 'utf8');
    return { rel, abs, raw, stripped: stripComments(raw) };
  });
}
