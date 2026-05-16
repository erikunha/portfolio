import { type GuitarRig, GuitarRigSchema } from './schemas';

export const guitarRig: GuitarRig = GuitarRigSchema.parse({
  comment: '# updated 2026-05-13',
  commentMobile: '# the other six strings',
  fields: [
    {
      label: 'GUITAR_MAIN',
      labelMobile: 'MAIN',
      value: 'Gretsch G5655TG · Electromatic Center Block Jr · Bigsby',
      valueMobile: 'Gretsch G5655TG · Bigsby',
    },
    { label: 'GUITAR_ALT', labelMobile: 'ALT', value: 'Martin acoustic' },
    {
      label: 'AMP',
      value: 'modeled · no tube in the chain',
      valueMobile: 'modeled · no tube',
    },
    {
      label: 'PEDALBOARD',
      labelMobile: 'PEDAL',
      value: 'Line 6 HX Stomp XL · amp + effects modeling',
      valueMobile: 'Line 6 HX Stomp XL',
    },
    {
      label: 'STYLE',
      value: 'feel / expression over noise · clean tones, lots of space',
      valueMobile: 'feel over noise · lots of space',
    },
    {
      label: 'TUNING',
      value: 'standard E · sometimes drop D · never Eb',
      valueMobile: 'standard E · sometimes drop D',
    },
    {
      label: 'PRACTICE',
      value: 'jams, tones, live takes · guitarcam',
      valueMobile: 'jams · tones · live takes',
    },
    {
      label: 'GIGS',
      value: 'weddings · small venues ·  open mics',
      valueMobile: 'weddings · small venues ·  open mics',
    },
    {
      label: 'NEVER_LEARNED',
      labelMobile: 'NEVER_LRND',
      value: 'reading staff notation · tabs only',
      valueMobile: 'tabs only · no staff notation',
    },
    {
      label: 'LATEST_OBSESSION',
      labelMobile: 'OBSESSION',
      value: 'Coldplay\'s "Yellow" — the simplicity is the hard part',
      valueMobile: 'Coldplay\'s "Yellow" · simplicity is hard',
    },
  ],
  influences: [
    { rank: 1, name: 'John Mayer' },
    { rank: 2, name: 'Mateus Asato' },
    { rank: 3, name: 'Jimmy Page' },
    { rank: 4, name: 'John Frusciante' },
    { rank: 5, name: "Iron Maiden's three (Murray · Smith · Gers)" },
  ],
  influencesMobile: [
    { rank: 1, name: 'John Mayer' },
    { rank: 2, name: 'Mateus Asato' },
    { rank: 3, name: 'Jimmy Page' },
    { rank: 4, name: 'John Frusciante' },
    { rank: 5, name: "Iron Maiden's three" },
  ],
});
