import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--font-mock', className: 'mock' }),
}));

describe('homepage meta description', () => {
  it('is <= 160 chars so Google does not truncate before the value terms', async () => {
    const { metadata } = await import('@/app/layout');
    const desc = String(metadata.description ?? '');
    expect(desc.length).toBeLessThanOrEqual(160);
    expect(desc.length).toBeGreaterThan(0);
  });

  it('retains the identity-gated substring', async () => {
    const { metadata } = await import('@/app/layout');
    expect(String(metadata.description)).toContain('Senior Full-Stack Engineer');
  });
});
