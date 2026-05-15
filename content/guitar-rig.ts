import { type GuitarRig, GuitarRigSchema } from './schemas';

export const guitarRig: GuitarRig = GuitarRigSchema.parse({
  fields: [
    { label: 'GUITAR_MAIN',      value: 'Gretsch G5655TG · Electromatic Center Block Jr · Bigsby' },
    { label: 'GUITAR_ALT',       value: 'Martin acoustic' },
    { label: 'AMP',              value: 'modeled · no tube in the chain' },
    { label: 'PEDALBOARD',       value: 'Line 6 HX Stomp XL · amp + effects modeling' },
    { label: 'STYLE',            value: 'feel / expression over noise · clean tones, lots of space' },
    { label: 'TUNING',           value: 'standard E · sometimes drop D · never Eb' },
    { label: 'PRACTICE',         value: 'jams, tones, live takes · guitarcam from the desk' },
    { label: 'GIGS',             value: 'played live with a band · small venues' },
    { label: 'NEVER_LEARNED',    value: 'reading staff notation · tabs only' },
    { label: 'LATEST_OBSESSION', value: `Coldplay's "Yellow" — the simplicity is the hard part` },
  ],
  influences: [
    { rank: 1, name: 'John Mayer' },
    { rank: 2, name: 'Mateus Asato' },
    { rank: 3, name: 'Jimmy Page' },
    { rank: 4, name: 'John Frusciante' },
    { rank: 5, name: "Iron Maiden's three (Murray · Smith · Gers)" },
  ],
  comment: '# updated 2026-05-13',
});
