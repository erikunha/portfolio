import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';

export interface StampCheck {
  valid: boolean;
  reason: string;
}

interface Stamp {
  fingerprint: string;
  buildId: string;
}

export const STAMP_FILE = '.next/.ci-predict-stamp.json';
export const BUILD_ID_FILE = '.next/BUILD_ID';
const FIELD_SEPARATOR = '\u0000';
const HASH = 'sha256';
const BYTES_PER_MIB = 1024 * 1024;
const GIT_MAX_BUFFER_BYTES = 256 * BYTES_PER_MIB;
const GIT_OK = 0;

interface Tree {
  head: string;
  diff: string;
  untracked: string[];
}

function contentHash(path: string): string {
  const stat = lstatSync(path);
  const bytes = stat.isSymbolicLink()
    ? Buffer.from(readlinkSync(path))
    : stat.isFile()
      ? readFileSync(path)
      : Buffer.alloc(0);
  return createHash(HASH).update(bytes).digest('hex');
}

function gitText(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: GIT_MAX_BUFFER_BYTES,
  });
  if (result.status !== GIT_OK) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

export function readTree(cwd: string, head: string): Tree {
  const untracked = gitText(cwd, ['ls-files', '-o', '--exclude-standard', '-z'])
    .split(FIELD_SEPARATOR)
    .filter(Boolean);
  return {
    head,
    diff: gitText(cwd, ['diff', 'HEAD', '--binary']),
    untracked: untracked.map((path) => `${path}${FIELD_SEPARATOR}${contentHash(join(cwd, path))}`),
  };
}

export function fingerprint(tree: Tree): string {
  return createHash(HASH)
    .update([tree.head, tree.diff, [...tree.untracked].sort().join('\n')].join(FIELD_SEPARATOR))
    .digest('hex');
}

export const stampText = (stamp: Stamp): string => JSON.stringify(stamp);

export function checkStamp(
  raw: string | undefined,
  current: { fingerprint: string; buildId: string | undefined },
): StampCheck {
  if (raw === undefined) {
    return {
      valid: false,
      reason:
        'the existing .next has no build stamp; run pnpm ci:predict once without --skip-build',
    };
  }
  let stamp: Partial<Stamp>;
  try {
    stamp = JSON.parse(raw) as Partial<Stamp>;
  } catch {
    return { valid: false, reason: 'the build stamp is unreadable; rebuild without --skip-build' };
  }
  if (stamp.fingerprint !== current.fingerprint) {
    return {
      valid: false,
      reason: 'the existing .next was built from another tree (commit or edits differ)',
    };
  }
  if (current.buildId === undefined || stamp.buildId !== current.buildId) {
    return { valid: false, reason: 'the .next build id changed after the stamp was written' };
  }
  return { valid: true, reason: '' };
}
