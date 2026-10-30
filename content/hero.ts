import { profile } from './profile';
import { HeroContentSchema } from './schemas';
import { social } from './social';

export const heroTagline = `${profile.title} · ${profile.technologyLine}`;

const EXTERNAL_PROTOCOL = 'https://';
export const heroContent = HeroContentSchema.parse({
  locationLabel: 'LOC:',
  employerLabel: 'NOW:',
  languageLabel: 'LANG:',
  statsLabel: 'Impact at scale',
  hire: {
    label: 'HIRE_ON_LINKEDIN ↗',
    href: social.linkedin,
    accessibleLabel: 'Hire on LinkedIn, opens in a new tab',
  },
  actions: [
    ...profile.actions,
    { label: 'VIEW_CV', href: '/cv' },
    { label: '30S_SUMMARY', href: '/summary' },
  ].map((action) => ({
    ...action,
    accessibleLabel: action.href.startsWith(EXTERNAL_PROTOCOL)
      ? `${action.label}, opens in a new tab`
      : action.label,
    external: action.href.startsWith(EXTERNAL_PROTOCOL),
  })),
  stats: [
    { value: '$500B+', label: 'fund assets' },
    { value: '8M+', label: 'e-com MAU' },
    { value: '40s→<1s', label: 'reporting API' },
    { value: '12-agent', label: 'platform AI' },
  ],
});
