import {
  type GuitarPresentation,
  GuitarPresentationSchema,
  type GuitarRig,
  GuitarRigSchema,
} from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

export const GUITAR_MODULE_HEADER = 'CAT ~/.GUITAR_RIG + ./MIX --LIVE';
export const GUITAR_MODULE_MOBILE_HEADER = 'GUITAR_RIG + MIX';

const guitarRigFor = (locale: SiteLocale): GuitarRig => {
  const pt = locale === SITE_LOCALE.pt;
  return GuitarRigSchema.parse({
    eqSpectrum: {
      label: 'LEAD · Gretsch G5655TG → HX Stomp XL → IR cab → FOH',
      ariaLabel: {
        prefix: pt
          ? 'Espectro ao vivo da guitarra solo sob sua curva de EQ'
          : 'Live spectrum of the lead guitar under its EQ curve',
        highpass: pt ? 'high-pass em {freq}' : 'high-pass at {freq}',
        lowpass: pt ? 'low-pass em {freq}' : 'low-pass at {freq}',
        boost: pt ? '{gain} dB de ganho em {freq}' : '{gain} dB boost at {freq}',
        cut: pt ? '{gain} dB de corte em {freq}' : '{gain} dB cut at {freq}',
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
    signalChain: [
      {
        role: 'INPUT',
        name: 'GRETSCH G5655TG',
        subtitle: pt ? 'Bigsby · corpo oco' : 'Bigsby · hollow body',
        strengthDots: 4,
      },
      {
        role: 'AMP',
        name: pt ? 'CAB MODELADO' : 'MODELED CAB',
        subtitle: pt ? 'sem válvula · simulação de IR' : 'no tube · IR sim',
        strengthDots: 3,
      },
      {
        role: 'OUT',
        name: 'FOH / IEM',
        subtitle: pt ? 'XLR estéreo · in-ear' : 'XLR stereo · in-ear',
        strengthDots: 5,
      },
    ],
    influences: [
      { name: 'John Mayer' },
      { name: 'Mateus Asato' },
      { name: 'Jimmy Page' },
      { name: 'John Frusciante' },
      { name: pt ? 'as três guitarras do Iron Maiden' : "Iron Maiden's three" },
    ],
    stats: [
      {
        label: pt ? 'ESTILO' : 'STYLE',
        value: pt ? 'dinâmica > drive' : 'dynamics > drive',
        sub: pt ? 'o espaço é a nota' : 'space is the note',
      },
      {
        label: pt ? 'AFINAÇÃO' : 'TUNING',
        value: pt ? 'mi padrão' : 'standard E',
        sub: pt ? 'às vezes drop D' : 'sometimes drop D',
      },
      {
        label: pt ? 'RIG ALT.' : 'ALT RIG',
        value: 'Martin',
        sub: pt ? 'acústico' : 'acoustic',
      },
      {
        label: pt ? 'SHOWS' : 'GIGS',
        value: pt ? 'eventos' : 'venues',
        sub: pt ? 'igreja · casamento · open mic' : 'church · wedding · open mic',
      },
    ],
    liveCam: {
      photo: '/images/guitar-live.jpg',
      caption: './GIGS --LIVE · SACRED + SWORN · FEEL OVER NOISE',
      status: pt ? '▶ REC · AO VIVO' : '▶ REC · LIVE',
      cameraLabel: pt ? 'CAM/01 · PALCO' : 'CAM/01 · STAGE',
    },
  });
};

export const guitarRig: Record<SiteLocale, GuitarRig> = {
  [SITE_LOCALE.en]: guitarRigFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: guitarRigFor(SITE_LOCALE.pt),
};

const guitarPresentationFor = (locale: SiteLocale): GuitarPresentation => {
  const pt = locale === SITE_LOCALE.pt;
  const rig = guitarRig[locale];
  const [input, amp, output] = rig.signalChain;
  return GuitarPresentationSchema.parse({
    signalStrengthLabelTemplate: pt ? '{n} de {total}' : '{n} of {total}',
    signalStrip: {
      live: pt ? '● SIGNAL_CHAIN.LIVE · SINAL OK' : '● SIGNAL_CHAIN.LIVE · SIGNAL OK',
      tail: 'TAIL -F ~/.RIG',
    },
    eqSpectrum: rig.eqSpectrum,
    signalChain: [
      { ...input, label: pt ? '// ENTRADA' : '// INPUT' },
      { ...amp, label: '// AMP' },
      { ...output, label: pt ? '// SAÍDA' : '// OUT' },
    ],
    influences: {
      label: pt ? 'INFLUÊNCIAS' : 'INFLUENCES',
      text: rig.influences.map(({ name }) => name).join(' · '),
    },
    nowPlaying: {
      label: pt ? 'obcecado por:' : 'now obsessing:',
      text: pt
        ? '"Yellow" do Coldplay: simplicidade é difícil.'
        : 'Coldplay\'s "Yellow": simplicity is hard.',
    },
    stats: rig.stats,
    photo: {
      src: rig.liveCam.photo,
      alt: pt
        ? 'Erik tocando guitarra no palco, show ao vivo'
        : 'Erik playing guitar on stage, live show',
      width: 450,
      height: 450,
    },
  });
};

export const guitarPresentation: Record<SiteLocale, GuitarPresentation> = {
  [SITE_LOCALE.en]: guitarPresentationFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: guitarPresentationFor(SITE_LOCALE.pt),
};
