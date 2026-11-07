import { EventEmitter } from 'node:events';
import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  INSTALL_ATTEMPT_TIMEOUT_MS,
  INSTALL_ATTEMPTS,
  installWithRetry,
  runAttempt,
} from '../../scripts/install-playwright-browsers.mjs';

const MINUTE_MS = 60 * 1000;

describe('runAttempt', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('kills the whole process group on timeout, so an orphaned apt cannot hold the dpkg lock', async () => {
    vi.useFakeTimers();
    const child = Object.assign(new EventEmitter(), { pid: 4242 });
    const spawn = vi.fn().mockReturnValue(child);
    const kill = vi.fn(() => child.emit('exit', null));
    const pending = runAttempt(['playwright'], { spawn, kill });
    expect(spawn.mock.calls[0]?.[2]).toMatchObject({ detached: true });
    vi.advanceTimersByTime(INSTALL_ATTEMPT_TIMEOUT_MS);
    await expect(pending).resolves.toEqual({ status: null, timedOut: true });
    expect(kill).toHaveBeenCalledWith(-4242, 'SIGKILL');
  });

  it('reports a normal exit without killing anything', async () => {
    const child = Object.assign(new EventEmitter(), { pid: 7 });
    const kill = vi.fn();
    const pending = runAttempt(['playwright'], { spawn: vi.fn().mockReturnValue(child), kill });
    child.emit('exit', 0);
    await expect(pending).resolves.toEqual({ status: 0, timedOut: false });
    expect(kill).not.toHaveBeenCalled();
  });
});

describe('installWithRetry', () => {
  it('retries a hung apt mirror instead of letting the job time out', async () => {
    const attempt = vi
      .fn()
      .mockResolvedValueOnce({ status: null, timedOut: true })
      .mockResolvedValueOnce({ status: 0, timedOut: false });
    const log = vi.fn();
    await expect(installWithRetry(['webkit'], { attempt, log })).resolves.toBe(0);
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(attempt.mock.calls[0]?.[0]).toContain('--with-deps');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('timed out'));
  });

  it('fails after the last attempt', async () => {
    const attempt = vi.fn().mockResolvedValue({ status: 1, timedOut: false });
    await expect(installWithRetry(['chromium'], { attempt, log: vi.fn() })).resolves.toBe(1);
    expect(attempt).toHaveBeenCalledTimes(INSTALL_ATTEMPTS);
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

  it('the e2e-functional job outlasts every install attempt with ten minutes left for its tests', () => {
    const ci = readFileSync(`${dir}/ci.yml`, 'utf8');
    const job = ci.slice(ci.indexOf('\n  e2e-functional:'));
    const minutes = Number(/timeout-minutes:\s*(\d+)/.exec(job)?.[1]);
    expect(minutes * MINUTE_MS).toBeGreaterThanOrEqual(
      INSTALL_ATTEMPTS * INSTALL_ATTEMPT_TIMEOUT_MS + 10 * MINUTE_MS,
    );
  });
});
