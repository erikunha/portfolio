import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_OWNER_LABEL } from '../lib/ci-predict-policy';

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  spawnSync: spawnSyncMock,
}));

const { descendantPids, sweepStaleSessions } = await import('../lib/ci-predict-process');

const DEAD_OWNER = 111;
const LIVE_OWNER = 222;

beforeEach(() => {
  spawnSyncMock.mockReset();
});

describe('descendantPids', () => {
  it('finds nothing, instead of throwing, when ps cannot run', () => {
    spawnSyncMock.mockReturnValue({
      status: null,
      stdout: null,
      stderr: null,
      error: new Error('x'),
    });
    expect(descendantPids(123)).toEqual([]);
  });
});

describe('sweepStaleSessions', () => {
  const listing = (stdout: string) => ({ status: 0, stdout, stderr: '' });

  it('lists only the containers carrying the owner label and removes only the stale ones', () => {
    spawnSyncMock.mockImplementation((_file: string, args: string[]) =>
      args[0] === 'ps'
        ? listing(
            `ci-predict-${DEAD_OWNER} ${DEAD_OWNER}\nci-predict-${LIVE_OWNER} ${LIVE_OWNER}\n`,
          )
        : { status: 0 },
    );
    const logged: string[] = [];
    sweepStaleSessions({ isAlive: (pid) => pid === LIVE_OWNER, log: (line) => logged.push(line) });
    const calls = spawnSyncMock.mock.calls as [string, string[]][];
    const ps = calls.find(([, args]) => args[0] === 'ps');
    expect(ps?.[0]).toBe('docker');
    expect(ps?.[1]).toContain(`label=${SESSION_OWNER_LABEL}`);
    const removed = calls.filter(([, args]) => args[0] === 'rm').map(([, args]) => args);
    expect(removed).toEqual([['rm', '-f', `ci-predict-${DEAD_OWNER}`]]);
    expect(logged).toHaveLength(1);
  });

  it('removes nothing when docker cannot list', () => {
    spawnSyncMock.mockReturnValue({ status: 1, stdout: 'ci-predict-1 1\n', stderr: 'down' });
    sweepStaleSessions({ isAlive: () => false, log: () => undefined });
    const calls = spawnSyncMock.mock.calls as [string, string[]][];
    expect(calls.filter(([, args]) => args[0] === 'rm')).toEqual([]);
  });
});
