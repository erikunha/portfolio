export interface AttemptResult {
  status: number | null;
  timedOut: boolean;
}

export const INSTALL_ATTEMPTS: number;
export const INSTALL_ATTEMPT_TIMEOUT_MS: number;
export function runAttempt(
  args: string[],
  options?: {
    spawn?: (
      command: string,
      args: string[],
      options: object,
    ) => {
      pid?: number;
      on: (event: 'exit', listener: (status: number | null) => void) => unknown;
    };
    kill?: (pid: number, signal: string) => unknown;
  },
): Promise<AttemptResult>;
export function installWithRetry(
  browsers: string[],
  options?: {
    attempt?: (args: string[]) => Promise<AttemptResult>;
    log?: (message: string) => void;
  },
): Promise<number>;
