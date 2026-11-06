import { perfReceipts } from './perf-receipts';
import { type Profile, ProfileSchema } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';
import { social } from './social';

const TECHNOLOGY_SEPARATOR = ' · ';

export const YEARS_OF_EXPERIENCE = 8;
export const YEARS_OF_EXPERIENCE_LABEL = `${YEARS_OF_EXPERIENCE}+ years`;

export const PROFILE_FACT = {
  txPerYear: '40M+',
  groupRevenue: '€1.197B',
  peakMau: '8M+',
  labsDelivered: '2.1M+',
  bankingClients: '24.2M',
} as const;

const DECIMAL_POINT_PATTERN = /(\d)\.(\d)/g;
const PT_DECIMAL_SEPARATOR = ',';

export const localizeDecimals = (text: string, locale: SiteLocale): string =>
  locale === SITE_LOCALE.pt
    ? text.replace(DECIMAL_POINT_PATTERN, `$1${PT_DECIMAL_SEPARATOR}$2`)
    : text;

export const FUNDS_SERVED = 50;
export const ASSETS_UNDER_MANAGEMENT_BILLIONS = 500;
export const FUNDS_PHRASE = `${FUNDS_SERVED}+ funds holding $${ASSETS_UNDER_MANAGEMENT_BILLIONS}B+ in assets`;
export const RAYLU_OWNED_SCOPE =
  "the frontend platform behind a private-markets product's data-dense pages";

const profileFields = ProfileSchema.parse({
  fullName: 'Erik Henrique Alves Cunha',
  displayName: 'Erik Cunha',
  title: 'Senior Software Engineer, Applied AI',
  stackLine: 'TypeScript, Python, React, Next.js, Angular, Node.js, AWS',
  aiLine: 'LLM Systems, Evals, Agents, MCP, Guardrails',
  country: 'Brazil',
  city: 'Paulínia',
  timezone: 'UTC-3',
  availability: 'available now',
  currentEmployer: {
    name: 'Raylu',
    url: 'https://raylu.ai',
    context: 'AI deal origination · private markets',
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

const STACK_ITEM_SEPARATOR = ', ';
const stackItems = profileFields.stackLine.split(STACK_ITEM_SEPARATOR);
const aiItems = profileFields.aiLine.split(STACK_ITEM_SEPARATOR);

export const profileStack = {
  all: [...stackItems, ...aiItems],
  core: stackItems,
  ai: aiItems,
};

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
  languageLevelsLine: string;
  location: string;
  tagline: string;
  summary: string;
  pageTitle: string;
  metaDescription: string;
};

const presentation = (locale: SiteLocale): ProfilePresentation => {
  const pt = locale === SITE_LOCALE.pt;
  const title = pt ? 'Engenheiro de Software Sênior, IA Aplicada' : profile.title;
  const country = pt ? 'Brasil' : profile.country;
  const availability = pt ? 'disponível agora' : profile.availability;
  const employerContext = pt
    ? 'originação de negócios com IA · mercados privados'
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
  const languageLevelsLine = profile.languages
    .map((language) => languageCell(language.label, language.level))
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
    languageLevelsLine,
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

const englishPresentation = profilePresentation[SITE_LOCALE.en];

export const profileLocation = englishPresentation.location;
export const profileCityLine = `${profile.city}, ${profile.country}`;

export const formatLanguages = (languages: typeof profile.languages) =>
  languages.map((language) => `${language.label} (${language.level})`).join(LANGUAGE_SEPARATOR);

export const profileLanguageLine = englishPresentation.languageLevelsLine;
export const profileWorkingLanguageLine = englishPresentation.workingLanguageLine;
export const profileSummary = englishPresentation.summary;
export const profilePageTitle = englishPresentation.pageTitle;
export const profileMetaDescription = englishPresentation.metaDescription;

const perfReceiptFor = (metric: string) => {
  const receipt = perfReceipts[SITE_LOCALE.en].find((entry) => entry.metric === metric);
  if (!receipt) throw new Error(`profile: unknown perf receipt "${metric}"`);
  return receipt;
};

export const receiptDelta = (metric: string): string => perfReceiptFor(metric).delta;

export const receiptDisplayValue = (metric: string): string => {
  const { displayValue } = perfReceiptFor(metric);
  if (!displayValue) throw new Error(`profile: perf receipt "${metric}" has no display value`);
  return displayValue;
};
