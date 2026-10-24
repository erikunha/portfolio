import { z } from 'zod';
import { profile } from './profile';
import { StatSchema } from './schemas';
import { social } from './social';

export const heroTagline = `${profile.title} · ${profile.technologyLine}`;
export const heroCurrentEmployer = profile.currentEmployer.name;
export const heroPlatformChip = profile.currentEmployer.context;

export const heroAuthorization = 'OPEN_TO_RELOCATION · WORLDWIDE';

export const HeroContentSchema = z.object({
  locationLabel: z.string().min(1),
  employerLabel: z.string().min(1),
  languagesLabel: z.string().min(1),
  statsLabel: z.string().min(1),
  stats: z.array(StatSchema).length(4),
  hire: z.object({
    label: z.string().min(1),
    accessibleLabel: z.string().min(1),
    href: z.string().url(),
  }),
});

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
