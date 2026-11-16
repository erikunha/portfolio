import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const CSS_DIR = 'app/css';
const HERO_OWNER = 'components-hero.css';
const HERO_SELECTOR = /hero-/;
const KEYFRAMES = /^(-\w+-)?keyframes$/;
const FAILURE_EXIT_CODE = 1;

function insideKeyframes(node: postcss.Rule): boolean {
  let parent: postcss.Node | undefined = node.parent;
  while (parent) {
    if (parent.type === 'atrule' && KEYFRAMES.test((parent as postcss.AtRule).name)) return true;
    parent = parent.parent;
  }
  return false;
}

const violations: string[] = [];
const cssRoot = path.join(ROOT, CSS_DIR);
const files = readdirSync(cssRoot)
  .filter((file) => file.endsWith('.css') && file !== HERO_OWNER)
  .sort();
for (const file of files) {
  const root = postcss.parse(readFileSync(path.join(cssRoot, file), 'utf-8'));
  root.walkRules((rule) => {
    if (insideKeyframes(rule) || !HERO_SELECTOR.test(rule.selector)) return;
    violations.push(`${CSS_DIR}/${file}: ${rule.selector.replace(/\s+/g, ' ')}`);
  });
}

if (violations.length === 0) {
  console.log(
    '✓ css-ownership: 0 violations, every hero selector rule lives in components-hero.css',
  );
  process.exit(0);
}

console.error(
  `✗ css-ownership: ${violations.length} violation${violations.length === 1 ? '' : 's'}:`,
);
for (const v of violations) console.error(`  ${v}`);
console.error(
  `  Hero layout and boot rules live in ${CSS_DIR}/${HERO_OWNER} only. Keyframes may stay in animations.css; a hero selector rule elsewhere splits the cascade across files.`,
);
process.exit(FAILURE_EXIT_CODE);
