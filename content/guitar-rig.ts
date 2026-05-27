import { type GuitarRig, GuitarRigSchema } from './schemas';

export const guitarRig: GuitarRig = GuitarRigSchema.parse({
  signalChain: [
    {
      role: 'INPUT',
      name: 'GRETSCH G5655TG',
      subtitle: 'Bigsby · hollow body',
      strengthDots: 4,
    },
    {
      role: 'FX',
      name: 'LINE 6 HX STOMP XL',
      subtitle: '8 blocks loaded',
      blocks: [
        { name: 'COMP', active: true },
        { name: 'OD', active: true },
        { name: 'FUZZ', active: false },
        { name: 'DLY', active: true },
        { name: 'REV', active: true },
        { name: 'MOD', active: false },
        { name: 'EQ', active: true },
        { name: 'VOL', active: false },
      ],
    },
    {
      role: 'AMP',
      name: 'MODELED CAB',
      subtitle: 'no tube · IR sim',
      strengthDots: 3,
    },
    {
      role: 'OUT',
      name: 'FOH / IEM',
      subtitle: 'XLR stereo · in-ear',
      strengthDots: 5,
    },
  ],
  influences: [
    { rank: 1, name: 'John Mayer', strength: 5, active: true },
    { rank: 2, name: 'Mateus Asato', strength: 4 },
    { rank: 3, name: 'Jimmy Page', strength: 3 },
    { rank: 4, name: 'John Frusciante', strength: 3 },
    { rank: 5, name: "Iron Maiden's three", strength: 2 },
  ],
  nowObsessing: 'Coldplay\'s "Yellow" — simplicity is hard.',
  stats: [
    { label: 'STYLE', value: 'feel over noise', sub: 'lots of space' },
    { label: 'TUNING', value: 'standard E', sub: 'sometimes drop D' },
    { label: 'ALT RIG', value: 'Martin', sub: 'acoustic' },
    { label: 'GIGS', value: 'small venues', sub: 'band setting' },
  ],
  liveCam: {
    photo: '/images/guitar-live.jpg',
    caption: './GIGS --LIVE · SMALL VENUES · FEEL OVER NOISE',
  },
});
