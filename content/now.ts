import { z } from 'zod';
import { type NowRow, NowRowSchema } from './schemas';

export const nowRows: NowRow[] = z.array(NowRowSchema).parse([
  {
    k: 'Currently',
    v: 'building the investor workflow frontend at Raylu · private-markets fintech',
  },
  { k: 'Reading', v: 'AI Engineering · Chip Huyen, applied LLM eval in prod' },
  { k: 'Building', v: 'this portfolio. you are looking at it.' },
  { k: 'Updated', v: '2026-10-16' },
]);

export const nowHeader = z.string().min(1).parse('CAT ~/.NOW');
