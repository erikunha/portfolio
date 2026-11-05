import { type Profile, ProfileSchema } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';
import { social } from './social';

// Canonical facts in English. Machine-readable surfaces (ask system prompt,
// JSON-LD, llms.txt, /api/erik.json) read this object and stay English per
// DECISIONS 2026-10-30; visitor-facing rendering reads profilePresentation.
const TECHNOLOGY_SEPARATOR = ' · ';

const profileFields = ProfileSchema.parse({
  fullName: 'Erik Henrique Alves Cunha',
  displayName: 'Erik Cunha',
  title: 'Senior Software Engineer · Full Stack',
  stackLine: 'React, Next.js, Angular, TypeScript, JavaScript, Node.js, Python, AWS',
  aiLine: 'LLM Apps, Evals, RAG, LangGraph, LangChain, Agents',
  country: 'Brazil',
  city: 'Paulínia',
  timezone: 'UTC-3',
  availability: 'available now',
  currentEmployer: {
    name: 'Raylu',
    url: 'https://raylu.ai',
    context: 'private-markets fintech · B2B SaaS',
  },
  languages: [
    {
      code: 'pt',
      label: 'PT-BR',
      name: 'Portuguese',
      level: 'native',
    },
    {
      code: 'en',
      label: 'EN',
      name: 'English',
      level: 'C1',
    },
    {
      code: 'es',
      label: 'ES',
      name: 'Spanish',
      level: 'B1',
    },
    {
      code: 'fr',
      label: 'FR',
      name: 'French',
      level: 'A2',
    },
  ],
  actions: [
    {
      label: 'GitHub ↗',
      href: social.github,
    },
  ],
});

export const profile: Profile = {
  ...profileFields,
  technologyLine: [profileFields.stackLine, profileFields.aiLine].join(TECHNOLOGY_SEPARATOR),
};

const LANGUAGE_SEPARATOR = ' · ';
const WORKING_LANGUAGE_LEVELS: readonly string[] = ['native', 'C2', 'C1'];

export type ProfilePresentation = {
  title: string;
  country: string;
  availability: string;
  employerContext: string;
  workingLanguageLine: string;
  languagesLine: string;
  location: string;
  tagline: string;
  summary: string;
  pageTitle: string;
  metaDescription: string;
};

const presentation = (locale: SiteLocale): ProfilePresentation => {
  const pt = locale === SITE_LOCALE.pt;
  const title = pt ? 'Engenheiro de Software Sênior · Full Stack' : profile.title;
  const country = pt ? 'Brasil' : profile.country;
  const availability = pt ? 'disponível agora' : profile.availability;
  const employerContext = pt
    ? 'fintech de mercados privados · B2B SaaS'
    : profile.currentEmployer.context;
  const levelWord = (level: string) => (pt && level === 'native' ? 'nativo' : level);
  const languageCell = (label: string, level: string) => `${label} ${levelWord(level)}`;
  const workingLanguageLine = profile.languages
    .filter((language) => WORKING_LANGUAGE_LEVELS.includes(language.level))
    .map((language) => languageCell(language.label, language.level))
    .join(LANGUAGE_SEPARATOR);
  const languagesLine = profile.languages
    .map((language) => `${language.label} (${levelWord(language.level)})`)
    .join(LANGUAGE_SEPARATOR);
  const location = `${country} · ${profile.timezone} · ${availability}`;
  const tagline = `${title} · ${profile.technologyLine}`;
  const summary = `${title}. ${location}. ${profile.currentEmployer.name}: ${employerContext}.`;
  return {
    title,
    country,
    availability,
    employerContext,
    workingLanguageLine,
    languagesLine,
    location,
    tagline,
    summary,
    pageTitle: `${profile.displayName} · ${title}`,
    metaDescription: `${title}. ${location}. ${profile.stackLine}.`,
  };
};

export const profilePresentation: Record<SiteLocale, ProfilePresentation> = {
  [SITE_LOCALE.en]: presentation(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: presentation(SITE_LOCALE.pt),
};

export const profileLocation = `${profile.country} · ${profile.timezone} · ${profile.availability}`;
export const profileCityLine = `${profile.city}, ${profile.country}`;
const languageLine = profile.languages
  .map((language) => `${language.label} ${language.level}`)
  .join(LANGUAGE_SEPARATOR);

export const formatLanguages = (languages: typeof profile.languages) =>
  languages.map((language) => `${language.label} (${language.level})`).join(LANGUAGE_SEPARATOR);

export const profileLanguageLine = languageLine;
export const profileWorkingLanguageLine = profile.languages
  .filter((language) => WORKING_LANGUAGE_LEVELS.includes(language.level))
  .map((language) => `${language.label} ${language.level}`)
  .join(LANGUAGE_SEPARATOR);
export const profileSummary = `${profile.title}. ${profileLocation}. ${profile.currentEmployer.name}: ${profile.currentEmployer.context}.`;
export const profilePageTitle = `${profile.displayName} · ${profile.title}`;
export const profileMetaDescription = `${profile.title}. ${profileLocation}. ${profile.stackLine}.`;
