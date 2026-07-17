export const NULL_DEVICE = '/dev/null';

export const ENV_ALLOWLIST = ['PATH', 'TMPDIR'];

export const GIT_CONFIG_ISOLATION: Record<string, string> = {
  GIT_CONFIG_GLOBAL: NULL_DEVICE,
  GIT_CONFIG_SYSTEM: NULL_DEVICE,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'core.excludesFile',
  GIT_CONFIG_VALUE_0: NULL_DEVICE,
};

export const hermeticEnv = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => {
  const env: Record<string, string> = { NODE_ENV: 'test', ...GIT_CONFIG_ISOLATION };
  for (const key of ENV_ALLOWLIST) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return { ...env, ...extra } as NodeJS.ProcessEnv;
};

export const inheritedEnvWithIsolatedGit = (
  extra: Record<string, string> = {},
): NodeJS.ProcessEnv =>
  ({
    ...process.env,
    ...GIT_CONFIG_ISOLATION,
    ...extra,
  }) as NodeJS.ProcessEnv;
