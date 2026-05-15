import { z } from 'zod';
import { type Credential, CredentialSchema } from './schemas';

export const credentials: Credential[] = z.array(CredentialSchema).parse([
  {
    label: 'ANGULAR_DEV',
    badge: 'CERTIFIED',
    evidence: 'Alain Chautard (GDE Angular) · 2024',
  },
  {
    label: 'ENGLISH',
    badge: 'IELTS_C1',
    evidence: 'band 6.5 (speaking & listening) · 2023',
  },
  {
    label: 'INTL_DEGREE',
    badge: 'WES_VERIFIED',
    evidence: 'World Education Services · 2022',
  },
]);
