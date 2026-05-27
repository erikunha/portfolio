import { describe, expect, it } from 'vitest';

describe('GuitarRigSchema v2', () => {
  it('rejects old flat-fields shape', async () => {
    const { GuitarRigSchema } = await import('./schemas');
    expect(() =>
      GuitarRigSchema.parse({ fields: [], influences: [], influencesMobile: [] }),
    ).toThrow();
  });

  it('accepts new signalChain + influences + stats shape', async () => {
    const { GuitarRigSchema } = await import('./schemas');
    expect(() =>
      GuitarRigSchema.parse({
        signalChain: [
          { role: 'INPUT', name: 'TEST', subtitle: 'sub', strengthDots: 4 },
          { role: 'FX', name: 'FX', subtitle: 'sub', blocks: [{ name: 'COMP', active: true }] },
          { role: 'AMP', name: 'AMP', subtitle: 'sub', strengthDots: 3 },
          { role: 'OUT', name: 'OUT', subtitle: 'sub', strengthDots: 5 },
        ],
        influences: [
          { rank: 1, name: 'A', strength: 5, active: true },
          { rank: 2, name: 'B', strength: 4 },
          { rank: 3, name: 'C', strength: 3 },
          { rank: 4, name: 'D', strength: 3 },
          { rank: 5, name: 'E', strength: 2 },
        ],
        nowObsessing: 'some song',
        stats: [
          { label: 'STYLE', value: 'feel', sub: 'lots' },
          { label: 'TUNING', value: 'standard', sub: 'drop D' },
          { label: 'ALT RIG', value: 'Martin', sub: 'acoustic' },
          { label: 'GIGS', value: 'small', sub: 'band' },
        ],
        liveCam: { photo: '/images/guitar-live.jpg', caption: './GIGS' },
      }),
    ).not.toThrow();
  });
});
