import { z } from 'zod';
import { type VisaRow, VisaRowSchema } from './schemas';

export const visaRows: VisaRow[] = z.array(VisaRowSchema).parse([
  {
    jurisdiction: 'EU (MALTA)',
    jurisdictionShort: 'EU (MT)',
    status: 'WORK_AUTHORIZED',
    statusShort: 'WORK_AUTHORIZED',
    evidence: 'active employer (Betsson)',
  },
  {
    jurisdiction: 'CA',
    jurisdictionShort: 'CA',
    status: 'CO_OP_GRADUATE',
    statusShort: 'CO_OP_GRAD',
    evidence: 'CICCC, Vancouver · 2023-2024',
  },
  {
    jurisdiction: 'BR',
    jurisdictionShort: 'BR',
    status: 'CITIZEN',
    statusShort: 'CITIZEN',
    evidence: 'native',
  },
  {
    jurisdiction: 'WORLDWIDE',
    jurisdictionShort: 'WORLD',
    status: 'OPEN_TO_RELOCATION',
    statusShort: 'OPEN_TO_RELOC',
    evidence: 'considering opportunities',
  },
]);
