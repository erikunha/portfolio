import { z } from 'zod';
import { profileSummary } from './profile';
import { type NowRow, NowRowSchema } from './schemas';
import { workAuthorizationSummary } from './visa';

export const nowRows: NowRow[] = z.array(NowRowSchema).parse([
  { k: 'Currently', v: `${profileSummary} ${workAuthorizationSummary}.` },
  { k: 'Reading', v: 'AI Engineering · Chip Huyen — applied LLM eval in prod' },
  { k: 'Building', v: 'this portfolio. you are looking at it.' },
  { k: 'Listening', v: 'a lot of guitar. compilers by day, six strings by night.' },
  { k: 'Updated', v: '2026-07-11' },
]);
