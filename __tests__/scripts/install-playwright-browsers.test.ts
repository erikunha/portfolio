import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  INSTALL_ATTEMPT_TIMEOUT_MS,
  INSTALL_ATTEMPTS,
  installWithRetry,
} from '../../scripts/install-playwright-browsers.mjs';

describe('installWithRetry', () => {
  it('retries a hung apt mirror instead of letting the job time out', () => {
    const spawn = vi
      .fn()
      .mockReturnValueOnce({ status: null, error: { code: 'ETIMEDOUT' } })
      .mockReturnValueOnce({ status: 0 });
    const log = vi.fn();
    expect(installWithRetry(['webkit'], { spawn, log })).toBe(0);
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(spawn.mock.calls[0]?.[2]).toMatchObject({ timeout: INSTALL_ATTEMPT_TIMEOUT_MS });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('timed out'));
  });

  it('fails after the last attempt', () => {
    const spawn = vi.fn().mockReturnValue({ status: 1 });
    expect(installWithRetry(['chromium'], { spawn, log: vi.fn() })).toBe(1);
    expect(spawn).toHaveBeenCalledTimes(INSTALL_ATTEMPTS);
  });

  it('all attempts leave the 15-minute e2e job time to run its tests', () => {
    expect(INSTALL_ATTEMPTS * INSTALL_ATTEMPT_TIMEOUT_MS).toBeLessThanOrEqual(10 * 60 * 1000);
  });
});

describe('workflows install browsers through the retry wrapper', () => {
  // behavioral-test-allow: the artifact under test is the workflow YAML; no runtime surface exists.
  const dir = `${process.cwd()}/.github/workflows`;
  const files = readdirSync(dir).filter((f) => f.endsWith('.yml'));
  it.each(files)('%s has no bare playwright install', (file) => {
    const text = readFileSync(`${dir}/${file}`, 'utf8');
    expect(text).not.toMatch(/run:\s*pnpm (exec )?playwright install/);
  });
});
