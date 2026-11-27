import { MS_PER_MINUTE } from '@/lib/time';

export const CHUNK_RECOVERY_STORAGE_KEY = 'chunk-recovery-at';
export const CHUNK_RECOVERY_WINDOW_MS = 10 * MS_PER_MINUTE;

const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Failed to load chunk|Loading (?:CSS )?chunk [^\s]+ failed/;

function describeError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return `${error.name} ${error.message}`;
  return '';
}

export function isChunkLoadError(error: unknown): boolean {
  return CHUNK_ERROR_PATTERN.test(describeError(error));
}

function claimRecovery(now: number): boolean {
  try {
    const stamp = Number(window.sessionStorage.getItem(CHUNK_RECOVERY_STORAGE_KEY));
    if (now - stamp < CHUNK_RECOVERY_WINDOW_MS) return false;
    window.sessionStorage.setItem(CHUNK_RECOVERY_STORAGE_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

export function recoverFromChunkLoadError(error: unknown): boolean {
  if (!isChunkLoadError(error) || !claimRecovery(Date.now())) return false;
  window.location.reload();
  return true;
}
