import { afterEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
const mockSet = vi.fn();
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({ get: mockGet, set: mockSet }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

afterEach(() => {
  vi.resetModules();
  mockGet.mockReset();
  mockSet.mockReset();
  mockFetch.mockReset();
  delete process.env.PSI_API_KEY;
});

const PSI_RESPONSE = {
  ok: true,
  json: async () => ({
    lighthouseResult: {
      categories: {
        performance: { score: 0.99 },
        accessibility: { score: 1 },
        'best-practices': { score: 0.95 },
        seo: { score: 1 },
      },
    },
  }),
};

describe('lighthouse scores fetch', () => {
  it('fetches once per cache miss with no next option', async () => {
    process.env.PSI_API_KEY = 'test-key';
    mockGet.mockResolvedValue(null);
    mockSet.mockResolvedValue('OK');
    mockFetch.mockResolvedValue(PSI_RESPONSE);
    const { getScores } = await import('@/lib/lighthouse-scores');
    await getScores('desktop');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]?.[1]).not.toHaveProperty('next');
  });

  it('fetches once per refresh with no next option', async () => {
    process.env.PSI_API_KEY = 'test-key';
    mockSet.mockResolvedValue('OK');
    mockFetch.mockResolvedValue(PSI_RESPONSE);
    const { refreshScores } = await import('@/lib/lighthouse-scores');
    await refreshScores('mobile');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]?.[1]).not.toHaveProperty('next');
  });
});
