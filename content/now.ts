import { z } from 'zod';
import { NOW_CURRENTLY } from './now-currently';
import { type NowRow, NowRowSchema } from './schemas';

export const nowRows: NowRow[] = z.array(NowRowSchema).parse([
  { k: 'Currently', v: NOW_CURRENTLY },
  { k: 'Reading', v: 'AI Engineering · Chip Huyen — applied LLM eval in prod' },
  { k: 'Building', v: 'this portfolio. you are looking at it.' },
  { k: 'Listening', v: 'a lot of guitar. compilers by day, six strings by night.' },
  { k: 'Updated', v: '2026-07-11' },
]);
