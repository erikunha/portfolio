import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadConfig() {
  vi.resetModules();
  return (await import('../../playwright.config')).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('playwright.config.ts flaky-test policy', () => {
  it('fails a CI run that passed only on a retry, and keeps the retries for traces', async () => {
    vi.stubEnv('CI', 'true');

    const config = await loadConfig();

    expect(
      config.failOnFlakyTests,
      'with retries on and failOnFlakyTests off, a test that fails once and passes on retry reports green, so a flake is never fixed',
    ).toBe(true);
    expect(config.retries, 'a failure with no retry leaves no trace to debug').toBeGreaterThan(0);
  });

  it('keeps a local run free of retries so a flake shows up on the first failure', async () => {
    vi.stubEnv('CI', '');

    const config = await loadConfig();

    expect(config.failOnFlakyTests).toBe(false);
    expect(config.retries).toBe(0);
  });
});
