import { z } from 'zod';
import { type NowRow, NowRowSchema } from './schemas';

export const nowRows: NowRow[] = z.array(NowRowSchema).parse([
  { k: 'Currently', v: 'shipping multi-currency settlement · Betsson cashier (PCI-DSS)' },
  { k: 'Reading', v: 'AI Engineering · Chip Huyen — applied LLM eval in prod' },
  { k: 'Building', v: 'this portfolio. you are looking at it.' },
  { k: 'Listening', v: 'a lot of guitar. compilers by day, six strings by night.' },
  { k: 'Updated', v: '2026-05-15' },
]);
