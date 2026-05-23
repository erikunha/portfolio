#!/usr/bin/env node
// Verifies every component in design-system/components/ has a ## heading
// in app/design-system/components/page.mdx.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = path.join(ROOT, 'design-system/components');
const docsPage = path.join(ROOT, 'app/design-system/components/page.mdx');

const componentNames = readdirSync(componentsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const docsContent = readFileSync(docsPage, 'utf8');
let missing = 0;

for (const name of componentNames) {
  if (!docsContent.includes(`## ${name}`)) {
    console.error(`MISSING DOCS: ${name} has no "## ${name}" heading in components/page.mdx`);
    missing++;
  }
}

if (missing > 0) {
  console.error(`\n${missing} component(s) missing documentation.`);
  process.exit(1);
}
console.log(`Component docs coverage OK (${componentNames.length} components).`);
