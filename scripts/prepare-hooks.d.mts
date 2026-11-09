export function shouldInstallHooks(env: Record<string, string | undefined>): boolean;
export function prepareHooks(options?: {
  env?: Record<string, string | undefined>;
  install?: () => number;
}): number;
