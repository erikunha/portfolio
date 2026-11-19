import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const componentsDir = path.join(ROOT, 'design-system/components');
const docsRoot = path.join(ROOT, 'app/(en)/design-system');
const indexPage = path.join(docsRoot, 'components/page.mdx');
const FAILURE_EXIT_CODE = 1;
const PROPS_TABLE_HEADER = /^\| Prop \|/m;
const WORD_BOUNDARY = /([a-z0-9])([A-Z])/g;
const KEBAB_JOIN = '$1-$2';

function slugOf(name: string): string {
  return name.replace(WORD_BOUNDARY, KEBAB_JOIN).toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const componentNames = readdirSync(componentsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const indexContent = existsSync(indexPage) ? readFileSync(indexPage, 'utf8') : '';
let failures = 0;

for (const name of componentNames) {
  const slug = slugOf(name);
  const page = path.join(docsRoot, 'primitives', slug, 'page.mdx');
  if (!existsSync(page)) {
    console.error(`MISSING PAGE: ${name} has no primitives/${slug}/page.mdx`);
    failures++;
    continue;
  }
  if (!PROPS_TABLE_HEADER.test(readFileSync(page, 'utf8'))) {
    console.error(
      `MISSING PROPS TABLE: ${name} page primitives/${slug}/page.mdx has no props table`,
    );
    failures++;
  }
  const link = new RegExp(`/design-system/primitives/${escapeRegExp(slug)}(?![\\w-])`);
  if (!link.test(indexContent)) {
    console.error(`MISSING INDEX LINK: ${name} is not linked from components/page.mdx`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n${failures} component docs failure(s).`);
  process.exit(FAILURE_EXIT_CODE);
}
console.log(`Component docs coverage OK (${componentNames.length} components).`);
