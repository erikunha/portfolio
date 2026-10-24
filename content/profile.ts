import { type Profile, ProfileSchema } from './schemas';

export const profile: Profile = ProfileSchema.parse({
  fullName: 'Erik Henrique Alves Cunha',
  displayName: 'Erik Cunha',
  title: 'Senior Software Engineer, Frontend & Product',
  technologyLine: 'React · Next.js · TypeScript · Angular · Node.js · AWS',
  country: 'Brazil',
  city: 'Paulínia',
  timezone: 'UTC-3',
  availability: 'available now',
  currentEmployer: {
    name: 'Raylu',
    context: 'private-markets fintech · B2B SaaS',
  },
  languages: [
    {
      code: 'pt',
      name: 'Portuguese',
      level: 'native',
    },
    {
      code: 'en',
      name: 'English',
      level: 'C1',
    },
  ],
  actions: [
    {
      label: 'GITHUB ↗',
      href: 'https://github.com/erikunha',
    },
    {
      label: 'VIEW_CV',
      mobileOnly: true,
      href: '/cv',
    },
    {
      label: '30S_SUMMARY',
      href: '/summary',
    },
  ],
});

export const profileLocation = `${profile.country} · ${profile.timezone} · ${profile.availability}`;
export const profileLanguageLine = profile.languages
  .map((language) => `${language.code.toUpperCase()} ${language.level}`)
  .join(' · ');
export const profileSummary = `${profile.title}. ${profileLocation}. ${profile.currentEmployer.name}: ${profile.currentEmployer.context}.`;
export const profilePageTitle = `${profile.displayName} · ${profile.title}`;
export const profileMetaDescription = `${profile.title}. ${profileLocation}. ${profile.technologyLine}.`;
