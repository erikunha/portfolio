type Run = (command: string, args: string[], options: object) => { status: number | null };

export const INSTALL_ATTEMPTS: number;
export const APT_CONFIG_PATH: string;
export const APT_CONFIG: string;
export function configureApt(options?: {
  run?: Run;
  platform?: string;
  ci?: string | undefined;
}): boolean;
export function installWithRetry(
  browsers: string[],
  options?: { run?: Run; log?: (message: string) => void },
): number;
