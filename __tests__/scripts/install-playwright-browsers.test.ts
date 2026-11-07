import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  APT_CONFIG,
  APT_CONFIG_PATH,
  configureApt,
  INSTALL_ATTEMPTS,
  installWithRetry,
} from '../../scripts/install-playwright-browsers.mjs';

describe('configureApt', () => {
  it('makes apt wait for a held dpkg lock and retry a stalled download on a Linux CI runner', () => {
    const run = vi.fn().mockReturnValue({ status: 0 });
    expect(configureApt({ run, platform: 'linux', ci: 'true' })).toBe(true);
    expect(run).toHaveBeenCalledWith(
      'sudo',
      ['tee', APT_CONFIG_PATH],
      expect.objectContaining({ input: `${APT_CONFIG}\n` }),
    );
    expect(APT_CONFIG).toMatch(/DPkg::Lock::Timeout/);
    expect(APT_CONFIG).toMatch(/Acquire::Retries/);
  });

  it('leaves a developer machine alone', () => {
    const run = vi.fn();
    expect(configureApt({ run, platform: 'darwin', ci: 'true' })).toBe(false);
    expect(configureApt({ run, platform: 'linux', ci: undefined })).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('installWithRetry', () => {
  it('retries a failed install and keeps --with-deps', () => {
    const run = vi.fn().mockReturnValueOnce({ status: 100 }).mockReturnValueOnce({ status: 0 });
    const log = vi.fn();
    expect(installWithRetry(['webkit'], { run, log })).toBe(0);
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[0]?.[1]).toContain('--with-deps');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('exited 100'));
  });

  it('fails after the last attempt', () => {
    const run = vi.fn().mockReturnValue({ status: 1 });
    expect(installWithRetry(['chromium'], { run, log: vi.fn() })).toBe(1);
    expect(run).toHaveBeenCalledTimes(INSTALL_ATTEMPTS);
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
