import { z } from 'zod';

export const EQ_TEMPLATE_TOKENS = { freq: '{freq}', gain: '{gain}' } as const;
export const EQ_DEFAULT_PEAK_Q = 0.8;
export const EQ_MIN_BAR_COUNT = 8;
export const EQ_MAX_BAR_COUNT = 144;

const eqFreqSchema = z.number().positive();

export const EqBandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('highpass'), freqHz: eqFreqSchema }),
  z.object({ kind: z.literal('lowpass'), freqHz: eqFreqSchema }),
  z.object({
    kind: z.literal('peak'),
    freqHz: eqFreqSchema,
    gainDb: z.number(),
    q: z.number().positive().default(EQ_DEFAULT_PEAK_Q),
  }),
]);
export type EqBand = z.infer<typeof EqBandSchema>;

const eqTemplate = (...tokens: string[]) =>
  tokens.reduce((schema, token) => schema.includes(token), z.string().trim().nonempty());

export const EqSpectrumSchema = z
  .object({
    label: z.string().trim().nonempty(),
    ariaLabel: z.object({
      prefix: z.string().trim().nonempty(),
      highpass: eqTemplate(EQ_TEMPLATE_TOKENS.freq),
      lowpass: eqTemplate(EQ_TEMPLATE_TOKENS.freq),
      boost: eqTemplate(EQ_TEMPLATE_TOKENS.freq, EQ_TEMPLATE_TOKENS.gain),
      cut: eqTemplate(EQ_TEMPLATE_TOKENS.freq, EQ_TEMPLATE_TOKENS.gain),
    }),
    bpm: z.number().positive(),
    barCount: z.number().int().min(EQ_MIN_BAR_COUNT).max(EQ_MAX_BAR_COUNT),
    freqRange: z.object({ minHz: eqFreqSchema, maxHz: eqFreqSchema }),
    bands: z.array(EqBandSchema).min(1),
    axis: z.array(z.object({ freqHz: eqFreqSchema, label: z.string().trim().nonempty() })).min(2),
  })
  .superRefine(({ freqRange, bands, axis }, ctx) => {
    const { minHz, maxHz } = freqRange;
    const inRange = (freqHz: number) => freqHz >= minHz && freqHz <= maxHz;
    if (minHz >= maxHz) {
      ctx.addIssue({ code: 'custom', path: ['freqRange'], message: 'minHz must be below maxHz' });
    }
    for (const [index, band] of bands.entries()) {
      if (!inRange(band.freqHz)) {
        ctx.addIssue({ code: 'custom', path: ['bands', index], message: 'band outside range' });
      }
    }
    for (const [index, tick] of axis.entries()) {
      if (!inRange(tick.freqHz)) {
        ctx.addIssue({ code: 'custom', path: ['axis', index], message: 'tick outside range' });
      }
      if (index > 0 && tick.freqHz <= (axis[index - 1]?.freqHz ?? 0)) {
        ctx.addIssue({ code: 'custom', path: ['axis', index], message: 'ticks must ascend' });
      }
    }
  });
export type EqSpectrum = z.infer<typeof EqSpectrumSchema>;
