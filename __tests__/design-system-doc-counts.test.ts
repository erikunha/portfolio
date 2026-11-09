import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const COMPONENTS_DIR = path.join(ROOT, 'design-system/components');
const BARREL_EXPORT = /^export \{ \w+ \} from/gm;

const COUNT_WORDS: Record<number, string> = { 9: 'Nine', 10: 'Ten', 11: 'Eleven' };

function read(file: string): string {
  // behavioral-test-allow: the property under test is that the docs state the component counts the directory holds; the docs are MDX and Markdown with no runtime surface
  return readFileSync(path.join(ROOT, file), 'utf8');
}

function count(): { total: number; client: number; barrel: number } {
  const dirs = readdirSync(COMPONENTS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  const client = dirs.filter((d) =>
    readdirSync(path.join(COMPONENTS_DIR, d.name))
      .filter((f) => /^[A-Z]\w+\.tsx$/.test(f) && !f.endsWith('.test.tsx'))
      // behavioral-test-allow: a client directive is a source-level fact with no runtime surface in jsdom
      .some((f) =>
        /^'use client'/.test(readFileSync(path.join(COMPONENTS_DIR, d.name, f), 'utf8')),
      ),
  );
  const barrel = read('design-system/index.ts').match(BARREL_EXPORT)?.length ?? 0;
  return { total: dirs.length, client: client.length, barrel };
}

describe('design-system docs state the component counts the directory holds', () => {
  const { total, client, barrel } = count();
  const server = total - client;

  it('README table', () => {
    expect(read('README.md')).toContain(
      `${total} components (${server} server-compatible; Field is client)`,
    );
  });

  it('design-system index page', () => {
    // behavioral-test-allow: the docs are the artifact under test; they have no runtime surface and their stated counts must match the component directory
    const page = read('app/(en)/design-system/page.mdx');
    expect(page).toContain(`${total} design-system components`);
    expect(page).toContain(`${COUNT_WORDS[server]} components have no client directive`);
  });

  it('components gallery page', () => {
    // behavioral-test-allow: the docs are the artifact under test; they have no runtime surface and their stated counts must match the component directory
    const page = read('app/(en)/design-system/components/page.mdx');
    expect(page).toContain(`contains ${COUNT_WORDS[total]?.toLowerCase()} components`);
    expect(page).toContain(`${COUNT_WORDS[server]} have no client directive`);
  });

  it('components doc', () => {
    // behavioral-test-allow: the docs are the artifact under test; they have no runtime surface and their stated counts must match the component directory
    expect(read('docs/04-components-and-state.md')).toContain(
      `${COUNT_WORDS[total]} primitives in \`design-system/components/\` (${COUNT_WORDS[server]?.toLowerCase()} server components, one client); **${COUNT_WORDS[barrel]?.toLowerCase()} exported**`,
    );
  });
});
