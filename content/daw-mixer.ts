import { type MixerBoot, MixerBootSchema } from './measured-states.schema';
import { type DawMixer, type DawMixerCopy, DawMixerCopySchema, DawMixerSchema } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

export const MASTER_CHANNEL_ID = 'MASTER';
export const METER_SEGMENTS = 12;
export const PLUGIN_STRENGTH_STEPS = 5;

export type { DawMixerCopy };

const dawMixerCopyFor = (locale: SiteLocale): DawMixerCopy => {
  const pt = locale === SITE_LOCALE.pt;
  return DawMixerCopySchema.parse({
    sessionLabel: pt ? 'SESSÃO:' : 'SESSION:',
    tracksLabel: pt ? 'FAIXAS DE GTR + MASTER' : 'GTR TRACKS + MASTER',
    separator: '·',
    transportSeparator: '|',
    playGlyph: '▶',
    bpmUnit: 'BPM',
    signalFlow: pt ? '// fluxo do sinal' : '// signal flow',
    leadSuffix: pt ? '= principal' : '= lead',
    loudnessLabel: 'LUFS',
    peakLabel: 'PK',
    decibelUnit: 'dB',
    columns: {
      id: 'ID',
      track: pt ? 'FAIXA' : 'TRACK',
      io: pt ? 'E/S' : 'I/O',
      toggles: 'R/M/S',
      pluginChain: pt ? 'CADEIA DE PLUGINS' : 'PLUGIN CHAIN',
      meter: pt ? 'MEDIDOR' : 'METER',
      fader: 'FADER',
    },
    controls: {
      vuMeter: pt
        ? 'medidor VU de demonstração, arraste para ajustar o nível'
        : 'VU meter demonstration, drag to adjust level',
      fader: 'fader',
      degrees: pt ? 'graus' : 'degrees',
      knobHint: pt
        ? 'arraste, use as setas, ou clique na metade de cima para subir e na de baixo para descer'
        : 'drag, use the arrow keys, or click the top half to raise and the bottom half to lower',
      buttons: {
        R: pt ? 'armar gravação' : 'record arm',
        M: pt ? 'mudo' : 'mute',
        S: 'solo',
      },
    },
  });
};

const dawMixerFor = (locale: SiteLocale): DawMixer => {
  const pt = locale === SITE_LOCALE.pt;
  return DawMixerSchema.parse({
    sessionName: 'YELLOW_TAKE_03.ALS',
    loadingLabel: pt ? 'carregando os canais do mixer' : 'loading the mixer channels',
    bpm: 87,
    timeSignature: '4/4',
    status: pt ? 'MIXAGEM' : 'MIXING',
    transportTime: '00:01:24:08',
    channels: [
      {
        id: 'CH 01',
        name: 'RHYTHM GTR',
        desc: pt
          ? 'Gretsch · palhetadas limpas · base principal · verso + refrão'
          : 'Gretsch · clean strums · main bed · verse + chorus',
        plugins: [
          { name: 'COMP', active: true, strength: 3 },
          { name: 'EQ', active: true, strength: 2 },
          { name: 'AMP/IR', active: true, strength: 4 },
          { name: 'PLATE', active: true, strength: 2 },
          { name: 'ROOM', active: true, strength: 2 },
        ],
        faderPct: 72,
        meterPct: 71,
        knob1: { label: 'GAIN', angleDeg: -30 },
        knob2: { label: 'PAN', angleDeg: -20 },
        buttons: ['R', 'M', 'S'],
        activeButtons: [],
      },
      {
        id: 'CH 02',
        name: 'LEAD GTR',
        focused: true,
        desc: pt
          ? 'Gretsch · linhas solo com OD · **a voz** · refrão + ponte'
          : 'Gretsch · OD lead lines · **the voice** · chorus + bridge',
        plugins: [
          { name: 'COMP', active: true, strength: 5 },
          { name: 'OD KLON', active: true, strength: 5 },
          { name: 'BOOST', active: true, strength: 4 },
          { name: 'TAPE DLY', active: true, strength: 4 },
          { name: 'REV', active: true, strength: 5 },
        ],
        faderPct: 72,
        meterPct: 93,
        meterClipping: true,
        knob1: { label: 'GAIN', angleDeg: -30 },
        knob2: { label: 'PAN', angleDeg: 0 },
        buttons: ['R', 'M', 'S'],
        activeButtons: ['R'],
      },
      {
        id: MASTER_CHANNEL_ID,
        name: '2-BUSS',
        desktopName: '2-BUSS · STEREO OUT',
        desc: pt
          ? 'soma de **2 faixas de gtr** · cadeia de masterização · feel over noise'
          : 'sum of **2 gtr tracks** · mastering chain · feel over noise',
        plugins: [
          { name: 'SSL BUSS', active: true, strength: 3 },
          { name: 'PULTEC', active: true, strength: 2 },
          { name: 'TAPE SAT', active: true, strength: 3 },
          { name: 'LIMITER', active: true, strength: 4 },
          { name: 'METER', active: true, strength: 5 },
        ],
        faderPct: 62,
        meterPct: 88,
        meterClipping: true,
        knob1: { label: 'COMP', angleDeg: -35 },
        knob2: { label: 'LIMIT', angleDeg: -45 },
        buttons: ['FX', 'EQ'],
        activeButtons: [],
        footer: { lufs: '-14', pk: '-0.3' },
        terminalLines: [
          '> headroom -3.2 · lufs -14 · pk -0.3 · mastered for streaming.',
          '> same philosophy as code: **fewer plugins, more space**.',
          'two tracks doing one job each beats six tracks competing.',
        ],
      },
    ],
  });
};

const mixerBootFor = (locale: SiteLocale): MixerBoot =>
  MixerBootSchema.parse({
    doneTag: '[ ok ]',
    loadingTag: '[ .. ]',
    queuedTag: '[    ]',
    sessionLabel: locale === SITE_LOCALE.pt ? 'sessão' : 'session',
    tempoUnit: 'bpm',
    separator: ' · ',
    cursor: '_',
  });

export const mixerBoot: Record<SiteLocale, MixerBoot> = {
  [SITE_LOCALE.en]: mixerBootFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: mixerBootFor(SITE_LOCALE.pt),
};

export const dawMixer: Record<SiteLocale, DawMixer> = {
  [SITE_LOCALE.en]: dawMixerFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: dawMixerFor(SITE_LOCALE.pt),
};

export const dawMixerCopy: Record<SiteLocale, DawMixerCopy> = {
  [SITE_LOCALE.en]: dawMixerCopyFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: dawMixerCopyFor(SITE_LOCALE.pt),
};
