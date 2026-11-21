import { existsSync, realpathSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function isMain(importMetaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const self = realpathSync(fileURLToPath(importMetaUrl));
  const candidate = [entry, `${entry}${extname(self)}`].find((path) => existsSync(path));
  return candidate !== undefined && realpathSync(candidate) === self;
}
