import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface ListFilesOptions {
  include: RegExp | ((name: string) => boolean);
  skipDirs?: ReadonlySet<string>;
}

export function listFiles(root: string, options: ListFilesOptions): string[] {
  const { include, skipDirs } = options;
  const matches = typeof include === 'function' ? include : (name: string) => include.test(name);
  const out: string[] = [];
  const walk = (relDir: string): void => {
    for (const entry of readdirSync(join(root, relDir), { withFileTypes: true })) {
      if (skipDirs?.has(entry.name)) continue;
      const rel = join(relDir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (matches(entry.name)) out.push(rel);
    }
  };
  walk('');
  return out.sort();
}
