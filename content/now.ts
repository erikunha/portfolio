import { z } from 'zod';
import { type NowRow, NowRowSchema } from './schemas';

export const NOW_CURRENTLY = z
  .string()
  .min(1)
  .parse(
    'shipping a headless DataTable platform · Raylu.ai (AI deal origination, private markets)',
  );

export const nowRows: NowRow[] = z.array(NowRowSchema).parse([
  { k: 'Currently', v: NOW_CURRENTLY },
  { k: 'Reading', v: 'AI Engineering · Chip Huyen — applied LLM eval in prod' },
  { k: 'Building', v: 'this portfolio. you are looking at it.' },
  { k: 'Listening', v: 'a lot of guitar. compilers by day, six strings by night.' },
  { k: 'Updated', v: '2026-07-11' },
]);
