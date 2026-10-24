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
    {
      code: 'es',
      name: 'Spanish',
      level: 'B1',
    },
    {
      code: 'fr',
      name: 'French',
      level: 'A2',
    },
  ],
  actions: [
    {
      label: 'GitHub ↗',
      href: 'https://github.com/erikunha',
    },
  ],
});

export const profileLocation = `${profile.country} · ${profile.timezone} · ${profile.availability}`;
const WORKING_LANGUAGE_LEVELS: readonly string[] = ['native', 'C2', 'C1'];
const languageLine = (languages: typeof profile.languages) =>
  languages.map((language) => `${language.code.toUpperCase()} ${language.level}`).join(' · ');

export const profileLanguageLine = languageLine(profile.languages);
export const profileWorkingLanguageLine = languageLine(
  profile.languages.filter((language) => WORKING_LANGUAGE_LEVELS.includes(language.level)),
);
export const profileSummary = `${profile.title}. ${profileLocation}. ${profile.currentEmployer.name}: ${profile.currentEmployer.context}.`;
export const profilePageTitle = `${profile.displayName} · ${profile.title}`;
export const profileMetaDescription = `${profile.title}. ${profileLocation}. ${profile.technologyLine}.`;
