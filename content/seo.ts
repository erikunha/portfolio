import { z } from 'zod';
import { communityEvent, communityTalksSentence } from './community';
import { profile, profileSummary, receiptDelta, YEARS_OF_EXPERIENCE_LABEL } from './profile';
import { SITE_LOCALE } from './site-locale';
import { social } from './social';
import { PHONE_NUMBER } from './social-urls';

export const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: profile.fullName,
  alternateName: profile.displayName,
  jobTitle: profile.title,
  url: social.site,
  email: social.email,
  telephone: PHONE_NUMBER,
  knowsLanguage: profile.languages.map((language) => ({
    '@type': 'Language',
    name: language.name,
    alternateName: language.level,
  })),
  nationality: { '@type': 'Country', name: profile.country },
  address: {
    '@type': 'PostalAddress',
    addressLocality: profile.city,
    addressRegion: 'São Paulo',
    addressCountry: 'BR',
  },
  sameAs: [social.linkedin, social.github],
  worksFor: {
    '@type': 'Organization',
    name: profile.currentEmployer.name,
    url: profile.currentEmployer.url,
  },
  description: `${profileSummary} ${YEARS_OF_EXPERIENCE_LABEL} across regulated industries. Track record: ${receiptDelta('API_LATENCY')} API latency, ${receiptDelta('BUNDLE_CSS')} CSS bundle, ${receiptDelta('TTI')} TTI.`,
  knowsAbout: [
    'LLM Engineering',
    'LLM Evaluation',
    'LLM-as-Judge Calibration',
    'Model Context Protocol (MCP)',
    'Prompt-Injection Defense',
    'AI Guardrails',
    'Agent Orchestration',
    'Retrieval-Augmented Generation (RAG)',
    'Generative AI',
    'Multi-Agent Orchestration',
    'AI Application Architecture',
    'Anthropic Claude',
    'Prompt Engineering',
    'Prompt Caching',
    'Streaming LLM Responses',
    'Function Calling',
    'Context Window Management',
    'LLM Cost Optimization',
    'AI Evaluation',
    'TypeScript',
    'TypeScript Strict Mode',
    'React 19',
    'React Server Components',
    'Next.js App Router',
    'Angular',
    'RxJS',
    'NgRx',
    'StencilJS',
    'Web Components',
    'Vue.js',
    'Ionic',
    'SSR/SSG',
    'Micro-Frontend Architecture',
    'Node.js',
    'Express.js',
    'REST API Design',
    'WebSocket',
    'Python',
    'Docker',
    'AWS',
    'Amazon S3',
    'CloudFront',
    'AWS CodePipeline',
    'PostgreSQL',
    'MongoDB',
    'Redis',
    'SQL',
    'Rate Limiting Architecture',
    'Backend for Frontend (BFF)',
    'Nx Monorepo',
    'Component-Driven Architecture',
    'PCI-DSS Systems',
    'Financial Technology',
    'Private Markets Technology',
    'AI-native SaaS',
    'Banking Technology',
    'E-commerce Platforms',
    'EdTech',
    'Performance Engineering',
    'Core Web Vitals',
    'Web Accessibility (WCAG 2.2 AA)',
    'ARIA',
    'CI/CD Pipelines',
    'GitHub Actions',
    'Playwright',
    'Jest',
    'React Testing Library',
    'MSW',
  ],
  hasOccupation: {
    '@type': 'Occupation',
    name: profile.title,
    occupationLocation: { '@type': 'Country', name: profile.country },
    skills:
      'TypeScript, Python, React, Next.js, Angular, Node.js, LLM Systems and Evaluation, Agents and Guardrails, PCI-DSS, AWS, Docker, Performance Engineering',
    experienceRequirements: YEARS_OF_EXPERIENCE_LABEL,
  },
  alumniOf: [
    {
      '@type': 'CollegeOrUniversity',
      name: 'Cornerstone International Community College of Canada (CICCC)',
      address: { '@type': 'PostalAddress', addressLocality: 'Vancouver', addressCountry: 'CA' },
    },
    {
      '@type': 'CollegeOrUniversity',
      name: 'Centro Universitário Salesiano de São Paulo (UNISAL)',
      address: { '@type': 'PostalAddress', addressLocality: 'Campinas', addressCountry: 'BR' },
    },
  ],
  hasCredential: [
    {
      '@type': 'EducationalOccupationalCredential',
      name: 'Angular Developer Certification',
      credentialCategory: 'certification',
      recognizedBy: {
        '@type': 'Organization',
        name: 'certificates.dev',
      },
    },
    {
      '@type': 'EducationalOccupationalCredential',
      name: 'Verified International Academic Qualifications',
      credentialCategory: 'certification',
      recognizedBy: { '@type': 'Organization', name: 'World Education Services (WES)' },
    },
  ],
  memberOf: {
    '@type': 'Organization',
    name: 'DevOpsDays Campinas',
    url: communityEvent[SITE_LOCALE.en].link.href,
    description: `Conference organizer, ${communityEvent[SITE_LOCALE.en].year}: ${communityTalksSentence}`,
  },
  seeks: {
    '@type': 'Demand',
    itemOffered: {
      '@type': 'JobPosting',
      title: profile.title,
      employmentType: 'FULL_TIME',
      jobLocationType: 'TELECOMMUTE',
      description: `${profileSummary} WES-verified credentials, English C1.`,
    },
  },
} as const;

z.object({
  name: z.string().min(1),
  alternateName: z.string().min(1),
  jobTitle: z.string().min(1),
  description: z.string().min(1),
  url: z.url(),
  email: z.email(),
}).parse(personSchema);

export const SITE_NAME = social.siteLabel;

export const SITE_KEYWORDS: string[] = [
  profile.title,
  'AI Engineering',
  'LLM Systems',
  'LLM Evaluation',
  'Agents',
  'Guardrails',
  'Angular',
  'React',
  'Next.js',
  'Node.js',
  'TypeScript',
  'PCI-DSS',
  'GenAI',
  'E-commerce',
  'AI-native SaaS',
];
export const OG_IMAGE_PATH = '/og.png';
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

export function ogImage(alt: string) {
  return { url: OG_IMAGE_PATH, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt };
}
