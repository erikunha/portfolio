import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SCAN_DIRS = ['app', 'components', 'lib', 'design-system', 'content'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '__tests__']);
const SOURCE_FILE = /\.(ts|tsx)$/;
const TEST_FILE = /\.(test|spec|e2e)\.(ts|tsx)$/;
const FORBIDDEN_FILES = new Set(['content/schemas.ts', 'content/perf-receipts.ts']);
const ZOD_SPECIFIER = /^zod(\/|$)/;
const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
const USE_CLIENT_WINDOW = 512;
const CHAIN_SEPARATOR = ' -> ';

const STATIC_IMPORT =
  /(?:^|\n)\s*(?:import|export)\s+(?!type\b)([^'"\n;]*?)\s*from\s*['"]([^'"]+)['"]/g;
const SIDE_EFFECT_IMPORT = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
const INLINE_TYPE_ONLY_SPECIFIERS = /^\{\s*(?:type\s+[^,}]+,?\s*)+\}$/;

function listSources(root: string, dir: string): string[] {
  const absolute = path.join(root, dir);
  if (!existsSync(absolute)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listSources(root, relative));
    else if (SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)) found.push(relative);
  }
  return found;
}

function readSource(root: string, file: string): string {
  // behavioral-test-allow: the import graph of the sources is the input under test
  return readFileSync(path.join(root, file), 'utf8');
}

function declaresUseClient(source: string): boolean {
  const head = source
    .slice(0, USE_CLIENT_WINDOW)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
    .join('\n');
  return /^["']use client["'];?/.test(head);
}

function isClientPath(file: string): boolean {
  return /\.client\.(ts|tsx)$/.test(file) || /(^|\/)client\//.test(file);
}

interface Edge {
  specifier: string;
  lazy: boolean;
}

function edgesOf(source: string): Edge[] {
  const edges: Edge[] = [];
  for (const match of source.matchAll(STATIC_IMPORT)) {
    const clause = (match[1] ?? '').trim();
    if (INLINE_TYPE_ONLY_SPECIFIERS.test(clause)) continue;
    edges.push({ specifier: match[2] ?? '', lazy: false });
  }
  for (const match of source.matchAll(SIDE_EFFECT_IMPORT)) {
    edges.push({ specifier: match[1] ?? '', lazy: false });
  }
  for (const match of source.matchAll(DYNAMIC_IMPORT)) {
    edges.push({ specifier: match[1] ?? '', lazy: true });
  }
  return edges;
}

function resolveLocal(root: string, specifier: string, from: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = specifier.slice(2);
  else if (specifier.startsWith('.')) base = path.posix.join(path.posix.dirname(from), specifier);
  else return null;
  for (const suffix of RESOLVE_SUFFIXES) {
    const candidate = `${base}${suffix}`;
    if (SOURCE_FILE.test(candidate) && existsSync(path.join(root, candidate))) return candidate;
  }
  return null;
}

function clientRoots(root: string): string[] {
  const roots = new Set<string>();
  for (const file of SCAN_DIRS.flatMap((dir) => listSources(root, dir))) {
    const source = readSource(root, file);
    if (isClientPath(file) || declaresUseClient(source)) roots.add(file);
    for (const edge of edgesOf(source)) {
      if (!edge.lazy) continue;
      const target = resolveLocal(root, edge.specifier, file);
      if (target) roots.add(target);
    }
  }
  return [...roots].sort();
}

function zodChains(root: string, entries: readonly string[]): string[] {
  const chains: string[] = [];
  for (const entry of entries) {
    const parent = new Map<string, string | null>([[entry, null]]);
    const queue = [entry];
    while (queue.length > 0) {
      const file = queue.shift() as string;
      const trail = (): string => {
        const files: string[] = [];
        for (let at: string | null | undefined = file; at; at = parent.get(at)) files.push(at);
        return files.reverse().join(CHAIN_SEPARATOR);
      };
      if (FORBIDDEN_FILES.has(file)) {
        chains.push(trail());
        continue;
      }
      for (const edge of edgesOf(readSource(root, file))) {
        if (ZOD_SPECIFIER.test(edge.specifier)) {
          chains.push(`${trail()}${CHAIN_SEPARATOR}${edge.specifier}`);
          continue;
        }
        const target = resolveLocal(root, edge.specifier, file);
        if (target && !parent.has(target)) {
          parent.set(target, file);
          queue.push(target);
        }
      }
    }
  }
  return [...new Set(chains)].sort();
}

function writeFixture(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'closure-'));
  for (const [file, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), body);
  }
  return root;
}

describe('client closure scanner', () => {
  it('names the full chain from a client file to zod through relative and alias imports', () => {
    const root = writeFixture({
      'components/Shell.client.tsx': "import { title } from '@/content/now';\n",
      'content/now.ts': "import { profile } from './profile';\n",
      'content/profile.ts': "import { z } from 'zod';\n",
    });
    expect(zodChains(root, clientRoots(root))).toEqual([
      'components/Shell.client.tsx -> content/now.ts -> content/profile.ts -> zod',
    ]);
  });

  it('follows a lazy import target and treats it as a client root', () => {
    const root = writeFixture({
      'components/Page.tsx': "const Panel = lazy(() => import('./panel/Panel'));\n",
      'components/panel/Panel.tsx': "import schemas from '@/content/schemas';\n",
      'content/schemas.ts': "import { z } from 'zod/v4';\n",
    });
    expect(clientRoots(root)).toEqual(['components/panel/Panel.tsx']);
    expect(zodChains(root, clientRoots(root))).toEqual([
      'components/panel/Panel.tsx -> content/schemas.ts',
    ]);
  });

  it('ignores type-only imports and server files', () => {
    const root = writeFixture({
      'components/Box.client.tsx':
        "'use client';\nimport type { T } from '@/content/schemas';\nimport { type U } from '@/content/schemas';\n",
      'content/schemas.ts': "import { z } from 'zod';\n",
      'lib/server.ts': "import { z } from 'zod';\n",
    });
    expect(zodChains(root, clientRoots(root))).toEqual([]);
  });
});

describe('client bundle closure', () => {
  it('reaches neither zod nor the schema modules from any client file or lazy import', () => {
    const roots = clientRoots('.');
    expect(roots.length).toBeGreaterThan(0);
    expect(
      zodChains('.', roots),
      'a client chunk pulls in zod: keep copy a client file imports in a module with no schema import',
    ).toEqual([]);
  });
});
