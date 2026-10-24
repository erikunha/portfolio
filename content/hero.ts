import { profile } from './profile';
import { HeroContentSchema } from './schemas';
import { social } from './social';
import { workAuthorization } from './visa';

export const heroTagline = `${profile.title} · ${profile.technologyLine}`;
export const heroCurrentEmployer = profile.currentEmployer.name;
export const heroPlatformChip = profile.currentEmployer.context;

export const heroAuthorization = `${workAuthorization.worldwide} · WORLDWIDE`;

export const heroContent = HeroContentSchema.parse({
  locationLabel: 'LOC:',
  employerLabel: 'NOW:',
  languagesLabel: 'LANG:',
  statsLabel: 'Impact at scale',
  stats: [
    { value: '$500B+', label: 'fund assets' },
    { value: '8M+', label: 'e-com MAU' },
    { value: '40s→<1s', label: 'reporting API' },
    { value: '12-agent', label: 'platform AI' },
  ],
  hire: {
    label: 'HIRE_ON_LINKEDIN ↗',
    accessibleLabel: 'Hire on LinkedIn, opens in a new tab',
    href: social.linkedin,
  },
});
export const heroStats = heroContent.stats;
