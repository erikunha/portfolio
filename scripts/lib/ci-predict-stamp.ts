import { createHash } from 'node:crypto';

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

export function fingerprint(tree: { head: string; diff: string; untracked: string[] }): string {
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
