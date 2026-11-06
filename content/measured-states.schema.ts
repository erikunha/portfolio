import { z } from 'zod';

const text = z.string().min(1);

export const ERROR_SECONDS_TOKEN = '{seconds}';
export const STALE_AGE_TOKEN = '{age}';
export const STALE_TIME_TOKEN = '{time}';

export const MeasuredStatesSchema = z.object({
  askError: z.object({
    heading: text,
    body: text.refine((value) => value.includes(ERROR_SECONDS_TOKEN)),
    retry: text,
    refLabel: text,
  }),
  perfStale: z.object({
    note: text.refine(
      (value) => value.includes(STALE_AGE_TOKEN) && value.includes(STALE_TIME_TOKEN),
    ),
    hourUnit: text,
    dayUnit: text,
  }),
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
