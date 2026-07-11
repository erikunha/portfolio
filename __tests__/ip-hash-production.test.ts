import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn<() => Promise<string | null>>();
const mockSet = vi.fn<() => Promise<string | null>>();

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => ({
      get: mockGet,
      set: mockSet,
    })),
  },
}));

vi.mock('@upstash/ratelimit', () => {
  // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional stub constructor
  function Ratelimit() {}
  Ratelimit.slidingWindow = () => ({});
  return { Ratelimit };
});

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('hashIp — production Upstash salt resolution', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DEPLOY_SALT;
    vi.stubEnv('NODE_ENV', 'production');
    mockGet.mockReset();
    mockSet.mockReset();
  });

  afterEach(() => {
    delete process.env.DEPLOY_SALT;
    vi.unstubAllEnvs();
  });

  it('uses salt from Redis when the key already exists', async () => {
    mockGet.mockResolvedValueOnce('existing-salt-abc123');

    const { hashIp } = await import('@/lib/ip-hash');
    const result = await hashIp('1.1.1.1');

    expect(result).toHaveLength(16);
    expect(result).toMatch(/^[0-9a-f]{16}$/);
    expect(mockGet).toHaveBeenCalledWith('meta:deploy-salt');
  });

  it('generates a new salt when the key does not exist and SETNX succeeds', async () => {
    mockGet.mockResolvedValueOnce(null);
    mockSet.mockResolvedValueOnce('OK');

    const { hashIp } = await import('@/lib/ip-hash');
    const result = await hashIp('2.2.2.2');

    expect(result).toHaveLength(16);
    expect(result).toMatch(/^[0-9a-f]{16}$/);
    expect(mockSet).toHaveBeenCalledWith('meta:deploy-salt', expect.any(String), { nx: true });
  });

  it('reads the winner salt when SETNX loses the race', async () => {
    mockGet.mockResolvedValueOnce(null).mockResolvedValueOnce('winner-salt-xyz');
    mockSet.mockResolvedValueOnce(null);

    const { hashIp } = await import('@/lib/ip-hash');
    const result = await hashIp('3.3.3.3');

    expect(result).toHaveLength(16);
    expect(result).toMatch(/^[0-9a-f]{16}$/);
  });

  it('throws when SETNX loses and the follow-up GET also misses (defensive path)', async () => {
    mockGet.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockSet.mockResolvedValueOnce(null);

    const { hashIp } = await import('@/lib/ip-hash');
    await expect(hashIp('4.4.4.4')).rejects.toThrow('DEPLOY_SALT auto-resolution failed');
  });
});
