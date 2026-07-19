#!/usr/bin/env node
/**
 * Mermaid fails silently: a diagram that does not parse renders as nothing at
 * all, so a broken block is invisible in the page rather than loud.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });

const { default: mermaid } = await import('mermaid');
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });

const files = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const FENCE = /```mermaid\n([\s\S]*?)```/g;
let total = 0;
const failures = [];

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // deleted-but-tracked during a rebase
  }
  let index = 0;
  for (const match of text.matchAll(FENCE)) {
    index += 1;
    total += 1;
    try {
      await mermaid.parse(match[1]);
    } catch (error) {
      const detail = String(error?.message ?? error)
        .split('\n')
        .slice(0, 3)
        .join(' ')
        .replace(/\s+/g, ' ');
      failures.push({ file, index, detail: detail.slice(0, 200) });
    }
  }
}

if (failures.length > 0) {
  console.error(`\nmermaid: ${failures.length} of ${total} diagrams do not parse.\n`);
  for (const f of failures) {
    console.error(`  ${f.file} (diagram #${f.index})`);
    console.error(`    ${f.detail}\n`);
  }
  console.error('A diagram that does not parse renders as nothing at all.');
  console.error('Common cause: a ; or unquoted ( ) : , inside a node label or sequence message.\n');
  process.exit(1);
}

console.log(`mermaid: ${total} diagrams parse.`);
