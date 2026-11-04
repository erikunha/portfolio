import { z } from 'zod';
import { communityEvent } from './community';
import { CareerCredentialsSchema, type Credential, CredentialSchema } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

// Credential tags are tokens and evidence facts (issuer · year); they stay
// identical across locales.
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

const careerCredentialsFor = (locale: SiteLocale) => {
  const pt = locale === SITE_LOCALE.pt;
  const event = communityEvent[locale];
  return CareerCredentialsSchema.parse({
    prompt: '$',
    statusMarker: '>',
    certifications: {
      label: pt ? 'Certificações' : 'Certifications',
      command: "git tag --list 'cert/*'",
      prefix: 'cert/',
    },
    education: {
      label: pt ? 'Formação' : 'Education',
      command: "git tag --list 'edu/*'",
      prefix: 'edu/',
    },
    community: {
      label: pt ? 'Comunidade' : 'Community',
      command: "git tag --list 'community/*'",
      heading: `community/${event.name} · ${event.year} · ${event.role}`,
      bullets: event.bullets,
      status: `status: ${event.statusLine}`,
    },
  });
};

export const careerCredentials: Record<SiteLocale, ReturnType<typeof careerCredentialsFor>> = {
  [SITE_LOCALE.en]: careerCredentialsFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: careerCredentialsFor(SITE_LOCALE.pt),
};
