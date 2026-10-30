import { z } from 'zod';
import { communityEvent, communityTalksSentence } from './community';
import { profile, profileSummary } from './profile';
import { social } from './social';

export const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: profile.fullName,
  alternateName: profile.displayName,
  jobTitle: profile.title,
  url: 'https://www.erikunha.dev',
  email: 'erikhenriquealvescunha@gmail.com',
  telephone: '+5519997049125',
  knowsLanguage: profile.languages.map((language) => ({
    '@type': 'Language',
    name: language.name,
    alternateName: language.level,
  })),
  nationality: { '@type': 'Country', name: 'Brazil' },
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
    url: 'https://raylu.ai',
  },
  description: `${profileSummary} 8+ years across regulated industries. Track record: -97.5% API latency, -98% CSS bundle, -52% TTI.`,
  knowsAbout: [
    'LLM Engineering',
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
    'Redux',
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
    'Clean Architecture',
    'Domain-Driven Design (DDD)',
    'Nx Monorepo',
    'Component-Driven Architecture',
    'PCI-DSS Systems',
    'Financial Technology',
    'Healthcare Technology',
    'Private Markets Technology',
    'B2B SaaS',
    'Banking Technology',
    'E-commerce Platforms',
    'EdTech',
    'Performance Engineering',
    'Core Web Vitals',
    'Web Accessibility (WCAG 2.1 AA)',
    'ARIA',
    'CI/CD Pipelines',
    'GitHub Actions',
    'Test-Driven Development',
    'Playwright',
    'Jest',
    'React Testing Library',
    'MSW',
    'Edge Computing',
  ],
  hasOccupation: {
    '@type': 'Occupation',
    name: profile.title,
    occupationLocation: { '@type': 'Country', name: profile.country },
    skills:
      'TypeScript, React, Angular, Next.js, Node.js, Python, LLM Engineering, RAG, Multi-Agent Systems, PCI-DSS, AWS, Docker, Performance Engineering',
    experienceRequirements: '8+ years',
  },
  alumniOf: [
    {
      '@type': 'CollegeOrUniversity',
      name: 'Instituto Infnet',
      address: { '@type': 'PostalAddress', addressCountry: 'BR' },
    },
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
    url: communityEvent.link.href,
    description: `Conference organizer, ${communityEvent.year}: ${communityTalksSentence}`,
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
  url: z.string().url(),
  email: z.string().email(),
}).parse(personSchema);

export const SITE_NAME = 'erikunha.dev';
export const OG_LOCALE = 'en_US';
export const OG_IMAGE_PATH = '/og.png';
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

export function ogImage(alt: string) {
  return { url: OG_IMAGE_PATH, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt };
}
