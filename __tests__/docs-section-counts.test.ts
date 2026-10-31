import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PageMain } from '@/components/PageMain';
import { DEFERRED_SECTION_COUNT } from '@/components/responsive/Module/module.constants';

const REPO_ROOT = path.resolve(__dirname, '..');
const read = (relativePath: string) => readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');

const NUMBER_WORDS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
] as const;

const PAGE_GRAPH_IMPORT_TIMEOUT_MS = 30_000;

function childNodes(node: unknown): unknown[] {
  if (!node || typeof node !== 'object') return [];
  const props = (node as { props?: Record<string, unknown> }).props;
  const children = props?.children;
  if (Array.isArray(children)) return children;
  return children ? [children] : [];
}

function findPageMainChildren(node: unknown): unknown {
  if (!node || typeof node !== 'object') return undefined;
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (element.type === PageMain) return element.props?.children;
  for (const child of childNodes(node)) {
    const found = findPageMainChildren(child);
    if (found !== undefined) return found;
  }
  return undefined;
}

function countHomeSections(node: unknown): number {
  const children = findPageMainChildren(node);
  if (Array.isArray(children)) return children.length;
  return children ? 1 : 0;
}

describe('documented counts match the code they describe', () => {
  it(
    'docs/README.md states how many section components the home page renders',
    async () => {
      const { default: Home } = await import('@/app/page');
      const sectionCount = countHomeSections(Home());
      expect(sectionCount).toBeGreaterThan(0);
      const readme = read('docs/README.md');
      expect(
        readme,
        'docs/README.md must state the number of section components app/page.tsx renders',
      ).toContain(`${sectionCount} section components`);
      expect(readme).toContain(`${sectionCount} terminal-themed section components`);
    },
    PAGE_GRAPH_IMPORT_TIMEOUT_MS,
  );

  it('ARCHITECTURE.md states how many below-fold modules are deferred', () => {
    const word = NUMBER_WORDS[DEFERRED_SECTION_COUNT];
    expect(word, 'DEFERRED_SECTION_COUNT has no number word').toBeDefined();
    expect(
      read('ARCHITECTURE.md'),
      'ARCHITECTURE.md must state the number of below-fold modules that use content-visibility deferral',
    ).toContain(`${word} below-fold modules use content-visibility deferral`);
  });
});
