import {
  type GuitarPresentation,
  GuitarPresentationSchema,
  type GuitarRig,
  GuitarRigSchema,
} from './schemas';

export const GUITAR_MODULE_HEADER = 'CAT ~/.GUITAR_RIG';
export const GUITAR_MODULE_MOBILE_HEADER = 'GUITAR_RIG';

export const guitarRig: GuitarRig = GuitarRigSchema.parse({
  eqSpectrum: {
    label: 'LEAD · Gretsch G5655TG → HX Stomp XL → IR cab → FOH',
    ariaLabel: {
      prefix: 'Live spectrum of the lead guitar under its EQ curve',
      highpass: 'high-pass at {freq}',
      lowpass: 'low-pass at {freq}',
      boost: '{gain} dB boost at {freq}',
      cut: '{gain} dB cut at {freq}',
    },
    bpm: 87,
    barCount: 72,
    freqRange: { minHz: 80, maxHz: 16000 },
    bands: [
      { kind: 'highpass', freqHz: 140 },
      { kind: 'peak', freqHz: 400, gainDb: -3 },
      { kind: 'peak', freqHz: 2800, gainDb: 5 },
      { kind: 'lowpass', freqHz: 9000 },
    ],
    axis: [
      { freqHz: 80, label: '80' },
      { freqHz: 200, label: '200' },
      { freqHz: 500, label: '500' },
      { freqHz: 1000, label: '1k' },
      { freqHz: 3000, label: '3k' },
      { freqHz: 8000, label: '8k' },
      { freqHz: 16000, label: '16k' },
    ],
  },
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
    telemetry: 'YELLOW_TAKE_03 · 87 BPM · STD E',
    hudTopLeft: 'HP140 · -3dB@400 · +5dB@2.8k · LP9k',
  },
});

export const guitarPresentation: GuitarPresentation = GuitarPresentationSchema.parse({
  signalStrip: {
    live: '● SIGNAL_CHAIN.LIVE · SIGNAL OK',
    tail: 'TAIL -F ~/.RIG',
  },
  eqSpectrum: guitarRig.eqSpectrum,
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
