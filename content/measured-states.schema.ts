import { z } from 'zod';

const text = z.string().min(1);

export const MeasuredStatesSchema = z.object({
  perfLoading: z.object({
    label: text,
    fetching: text,
    placeholder: text,
    tiles: z.object({
      performance: text,
      accessibility: text,
      bestPractices: text,
      seo: text,
    }),
  }),
});

export type MeasuredStates = z.infer<typeof MeasuredStatesSchema>;
