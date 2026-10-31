import { z } from 'zod';
import { communityEvent } from './community';
import { CareerCredentialsSchema, type Credential, CredentialSchema } from './schemas';

export const credentials: Credential[] = z.array(CredentialSchema).parse([
  {
    label: 'ANGULAR_DEV',
    badge: 'CERTIFIED',
    evidence: 'certificates.dev · 2024',
  },
  {
    label: 'ENGLISH',
    badge: 'IELTS_GENERAL_TRAINING',
    evidence: 'C1 · 2023',
  },
  {
    label: 'INTL_DEGREE',
    badge: 'WES_VERIFIED',
    evidence: 'World Education Services · 2022',
  },
]);

export const careerCredentials = CareerCredentialsSchema.parse({
  prompt: '$',
  statusMarker: '>',
  certifications: {
    label: 'Certifications',
    command: "git tag --list 'cert/*'",
    prefix: 'cert/',
  },
  education: {
    label: 'Education',
    command: "git tag --list 'edu/*'",
    prefix: 'edu/',
  },
  community: {
    label: 'Community',
    command: "git tag --list 'community/*'",
    heading: `community/${communityEvent.name} · ${communityEvent.year} · ${communityEvent.role}`,
    bullets: communityEvent.bullets,
    status: `status: ${communityEvent.statusLine}`,
  },
});
