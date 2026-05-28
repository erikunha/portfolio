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
        liveCam: {
          photo: '/images/guitar-live.jpg',
          caption: './GIGS',
          status: '▶ REC',
          cameraLabel: 'CAM/01',
        },
      }),
    ).not.toThrow();
  });
});

const baseChannel = (id: string) => ({
  id,
  name: 'TEST',
  desc: 'test desc',
  plugins: [{ name: 'COMP', active: true, strength: 3 }],
  faderPct: 72,
  db: '-2.5',
  meterPct: 71,
  knob1: { label: 'GAIN', angleDeg: -30 },
  knob2: { label: 'PAN', angleDeg: 0 },
  buttons: ['R', 'M', 'S'],
  activeButtons: [],
});

const validSixChannels = [
  baseChannel('CH 01'),
  baseChannel('CH 02'),
  baseChannel('CH 03'),
  baseChannel('CH 04'),
  baseChannel('CH 05'),
  { ...baseChannel('MASTER'), buttons: ['FX', 'EQ'] },
];

describe('DawMixerSchema', () => {
  it('accepts a valid 6-channel config with MASTER last', async () => {
    const { DawMixerSchema } = await import('./schemas');
    expect(() =>
      DawMixerSchema.parse({
        sessionName: 'TEST.ALS',
        bpm: 87,
        timeSignature: '4/4',
        status: 'MIXING',
        transportTime: '00:01:24:08',
        channels: validSixChannels,
      }),
    ).not.toThrow();
  });

  it('rejects fewer than 6 channels', async () => {
    const { DawMixerSchema } = await import('./schemas');
    expect(() =>
      DawMixerSchema.parse({
        sessionName: 'TEST.ALS',
        bpm: 87,
        timeSignature: '4/4',
        status: 'MIXING',
        transportTime: '00:01:24:08',
        channels: validSixChannels.slice(0, 5),
      }),
    ).toThrow();
  });

  it('rejects 6 channels when last is not MASTER', async () => {
    const { DawMixerSchema } = await import('./schemas');
    const noMaster = validSixChannels.map((c) => ({
      ...c,
      id: c.id === 'MASTER' ? 'CH 06' : c.id,
    }));
    expect(() =>
      DawMixerSchema.parse({
        sessionName: 'TEST.ALS',
        bpm: 87,
        timeSignature: '4/4',
        status: 'MIXING',
        transportTime: '00:01:24:08',
        channels: noMaster,
      }),
    ).toThrow();
  });
});
