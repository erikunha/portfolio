export interface SpawnResult {
  status: number | null;
  error?: { code?: string };
}

export const INSTALL_ATTEMPTS: number;
export const INSTALL_ATTEMPT_TIMEOUT_MS: number;
export function installWithRetry(
  browsers: string[],
  options?: {
    spawn?: (command: string, args: string[], options: object) => SpawnResult;
    log?: (message: string) => void;
  },
): number;
