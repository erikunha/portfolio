import {
  type GuitarPresentation,
  GuitarPresentationSchema,
  type GuitarRig,
  GuitarRigSchema,
} from './schemas';

export const GUITAR_MODULE_HEADER = 'CAT ~/.GUITAR_RIG + ./MIX --LIVE';
export const GUITAR_MODULE_MOBILE_HEADER = 'GUITAR_RIG + MIX';

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
    { name: 'John Mayer' },
    { name: 'Mateus Asato' },
    { name: 'Jimmy Page' },
    { name: 'John Frusciante' },
    { name: "Iron Maiden's three" },
  ],
  stats: [
    { label: 'STYLE', value: 'dynamics > drive', sub: 'space is the note' },
    { label: 'TUNING', value: 'standard E', sub: 'sometimes drop D' },
    { label: 'ALT RIG', value: 'Martin', sub: 'acoustic' },
    { label: 'GIGS', value: 'venues', sub: 'church · wedding · open mic' },
  ],
  liveCam: {
    photo: '/images/guitar-live.jpg',
    caption: './GIGS --LIVE · SACRED + SWORN · FEEL OVER NOISE',
    status: '▶ REC · LIVE',
    cameraLabel: 'CAM/01 · STAGE',
  },
});

const [guitarInput, , guitarAmp, guitarOutput] = guitarRig.signalChain;

export const guitarPresentation: GuitarPresentation = GuitarPresentationSchema.parse({
  signalStrengthLabelTemplate: '{n} of {total}',
  signalStrip: {
    live: '● SIGNAL_CHAIN.LIVE · SIGNAL OK',
    tail: 'TAIL -F ~/.RIG',
  },
  signalChain: [
    { ...guitarInput, label: '// INPUT' },
    { ...guitarAmp, label: '// AMP' },
    { ...guitarOutput, label: '// OUT' },
  ],
  influences: {
    label: 'INFLUENCES',
    text: guitarRig.influences.map(({ name }) => name).join(' · '),
  },
  nowPlaying: {
    label: 'now obsessing:',
    text: 'Coldplay\'s "Yellow": simplicity is hard.',
  },
  stats: guitarRig.stats,
  photo: {
    src: guitarRig.liveCam.photo,
    alt: 'Erik playing guitar on stage, live show',
    width: 450,
    height: 450,
  },
});
