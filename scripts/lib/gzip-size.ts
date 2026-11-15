import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

export function gzipBytes(path: string): number {
  return gzipSync(readFileSync(path)).length;
}
