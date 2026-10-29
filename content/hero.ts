import { profile } from './profile';
import type { HeroContent } from './schemas';
import { workAuthorization } from './visa';

export const heroTagline = `${profile.title} · ${profile.technologyLine}`;
export const heroCurrentEmployer = profile.currentEmployer.name;
export const heroPlatformChip = profile.currentEmployer.context;

export const heroAuthorization = `${workAuthorization.worldwide} · WORLDWIDE`;

export const heroContent: HeroContent = {
  locationPrefix: 'LOC: ',
  nowPrefix: 'NOW: ',
  hireCtaLabel: 'EXEC HIRE',
  githubCtaLabel: 'GITHUB ↗',
  statsAriaLabel: 'Impact at scale',
  systemFailurePlate: 'SYSTEM FAILURE',
  bootStaticDialogLine: 'The Matrix has you...',
};
