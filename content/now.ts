import { z } from 'zod';
import { profileSummary } from './profile';
import { type NowRow, NowRowSchema } from './schemas';
import { workAuthorizationSummary } from './visa';

export const nowRows: NowRow[] = z.array(NowRowSchema).parse([
  { k: 'Currently', v: `${profileSummary} ${workAuthorizationSummary}.` },
  { k: 'Reading', v: 'AI Engineering · Chip Huyen, applied LLM eval in prod' },
  { k: 'Building', v: 'this portfolio. you are looking at it.' },
  { k: 'Updated', v: '2026-10-16' },
]);

export const nowHeader = z.string().min(1).parse('CAT ~/.NOW');
