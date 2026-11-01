import { HIRE_ACCESSIBLE_NAME, NAV_VOCABULARY } from './nav';
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
    label: NAV_VOCABULARY.hire,
    href: social.linkedin,
    accessibleLabel: HIRE_ACCESSIBLE_NAME,
  },
  actions: [
    ...profile.actions,
    { label: 'VIEW_CV', href: '/cv', hiddenOnWide: true },
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
