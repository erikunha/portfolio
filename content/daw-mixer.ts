import { type DawMixer, DawMixerSchema } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

// DAW voice (track names, plugins, knobs, transport, terminal lines) stays
// English on both locales: a DAW speaks English everywhere, including in
// Brazil. Channel descriptions are visitor-facing prose and carry the
// translation.
const dawMixerFor = (locale: SiteLocale): DawMixer => {
  const pt = locale === SITE_LOCALE.pt;
  return DawMixerSchema.parse({
    sessionName: 'YELLOW_TAKE_03.ALS',
    bpm: 87,
    timeSignature: '4/4',
    status: 'MIXING',
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
        id: 'CH 03',
        name: 'ACOUSTIC DBL',
        desc: pt
          ? 'Martin · fingerpick · dobrado uma 8vb abaixo · intro + ponte'
          : 'Martin · fingerpick · doubled 8va below · intro + bridge',
        plugins: [
          { name: 'PREAMP', active: true, strength: 2 },
          { name: 'EQ', active: true, strength: 3 },
          { name: 'COMP', active: true, strength: 2 },
          { name: 'CHORUS', active: true, strength: 2 },
          { name: 'PLATE', active: true, strength: 3 },
        ],
        faderPct: 40,
        meterPct: 50,
        knob1: { label: 'GAIN', angleDeg: -40 },
        knob2: { label: 'PAN', angleDeg: -25 },
        buttons: ['R', 'M', 'S'],
        activeButtons: [],
      },
      {
        id: 'CH 04',
        name: 'PAD GTR',
        desc: pt
          ? 'Gretsch · volume swells · espaço amplo · fica atrás de tudo'
          : 'Gretsch · volume swells · big space · sits behind everything',
        plugins: [
          { name: 'VOL', active: true, strength: 3 },
          { name: 'CHORUS', active: true, strength: 4 },
          { name: 'SHIMMER', active: true, strength: 5 },
          { name: 'BIG REV', active: true, strength: 4 },
          { name: 'LP FILT', active: true, strength: 2 },
        ],
        faderPct: 30,
        meterPct: 34,
        knob1: { label: 'GAIN', angleDeg: -60 },
        knob2: { label: 'WIDTH', angleDeg: -10 },
        buttons: ['R', 'M', 'S'],
        activeButtons: [],
      },
      {
        id: 'CH 05',
        name: 'HARMONY DBL',
        desc: pt
          ? 'Gretsch · terça acima · overdub de twin-lead · só refrão'
          : 'Gretsch · third up · twin-lead overdub · chorus only',
        plugins: [
          { name: 'COMP', active: true, strength: 2 },
          { name: 'HARM+3', active: true, strength: 5 },
          { name: 'EQ', active: true, strength: 2 },
          { name: 'DLY', active: true, strength: 2 },
          { name: 'FUZZ', active: false, strength: 0 },
        ],
        faderPct: 35,
        meterPct: 43,
        knob1: { label: 'GAIN', angleDeg: -50 },
        knob2: { label: 'PAN', angleDeg: -60 },
        buttons: ['R', 'M', 'S'],
        activeButtons: ['M'],
      },
      {
        id: 'MASTER',
        name: '2-BUSS',
        desktopName: '2-BUSS — STEREO OUT',
        desc: pt
          ? 'soma de **5 faixas de gtr** · cadeia de masterização · feel over noise'
          : 'sum of **5 gtr tracks** · mastering chain · feel over noise',
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
          'five tracks doing one job each beats fifteen tracks competing.',
        ],
      },
    ],
  });
};

export const dawMixer: Record<SiteLocale, DawMixer> = {
  [SITE_LOCALE.en]: dawMixerFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: dawMixerFor(SITE_LOCALE.pt),
};
