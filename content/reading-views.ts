import { communityEvent } from './community';
import { credentials } from './credentials';
import { education } from './education';
import { gitLog } from './git-log';
import { heroStats } from './perf-receipts';
import { profile, profileLocation, profileSummary } from './profile';
import { projects } from './projects';
import { READING_PATHS } from './reading-paths';
import { readmeCopy } from './readme';
import {
  CvDocumentSchema,
  CvJsonLdSchema,
  ReadingViewsSchema,
  SummaryDocumentSchema,
} from './schemas';
import { social } from './social';
import { visaRows, workAuthorizationProse } from './visa';

export { READING_PATHS };

const SITE_ORIGIN_PATTERN = /^(https?:\/\/)www\./;
const PROTOCOL_PATTERN = /^https?:\/\//;
const TRAILING_PERIOD_PATTERN = /\.$/;
const TERMINAL_PUNCTUATION_PATTERN = /[.!?]$/;
const FRAGMENT_SEPARATOR_PATTERN = /;\s+/;
const BULLET_PREFIX_PATTERN = /^-\s*/;
const STACK_SEPARATOR = ' · ';
const WORD_SEPARATOR = '_';

export const readingViews = ReadingViewsSchema.parse({
  shared: {
    skipLabel: 'Skip to main content',
    homeLabel: 'erik_cunha.sh',
    navLabel: 'Site navigation',
    nav: [
      { label: 'ABOUT', href: '/#sec-readme' },
      { label: 'WORK', href: '/#sec-projects' },
      { label: 'CAREER', href: '/#sec-git-log' },
      { label: 'CONTACT', href: '/#sec-contact' },
      { label: 'DESIGN_SYSTEM', href: '/design-system' },
    ],
    hire: {
      label: 'HIRE_ON_LINKEDIN ↗',
      ariaLabel: 'Hire on LinkedIn, opens in a new tab',
      href: social.linkedin,
    },
    printLabel: 'PRINT / SAVE PDF',
    newTabRel: 'noopener noreferrer',
    newTabHint: '(opens in a new tab)',
    homeHref: '/',
    ogImage: { path: '/og.png', width: 1200, height: 630 },
  },
  cv: {
    path: READING_PATHS.cv,
    title: `CV · ${profile.displayName}`,
    description: `${profile.displayName}, ${profile.title}. Readable, printable CV.`,
    summaryLinkLabel: '30S_SUMMARY',
    headings: {
      summary: 'Summary',
      experience: 'Experience',
      skills: 'Skills',
      certifications: 'Certifications',
      community: 'Community',
      education: 'Education',
      workAuthorization: 'Work authorization',
      contact: 'Contact',
    },
    credentialLabels: {
      ANGULAR_DEV: 'Angular Developer',
      ENGLISH: 'English',
      INTL_DEGREE: 'International degree',
    },
    proseOverrides: {
      'wanted ai-native product scale': 'Joined to scale an AI-native product.',
      'wanted regulated multi-market scale': 'Joined to work at regulated, multi-market scale.',
      'got 40m+ tx/yr across 15+ jurisdictions on a pci-dss payment platform':
        'Shipped a PCI-DSS payment platform handling 40M+ transactions a year across 15+ jurisdictions.',
      'angular 17 to 19': 'Upgraded the platform from Angular 17 to 19.',
      'next.js storefronts for nike brazil and centauro (8m+ mau)':
        'Shipped Next.js storefronts for Nike Brazil and Centauro (8M+ MAU).',
      'vmware pathfinder lab portal on angular 11':
        'Shipped the VMware Pathfinder lab portal on Angular 11.',
      'ngrx effects, reactive forms, 2.1m+ labs':
        'Used NgRx effects and Reactive Forms across 2.1M+ labs.',
      'first regulated / banking work': 'First regulated banking work.',
      "angular elements micro-frontends for itaú's business insurance (24.2m digital clients)":
        "Shipped Angular Elements micro-frontends for Itaú's business insurance (24.2M digital clients).",
      'cut teeth on backend': 'Started on the backend.',
      'reporting api 40s → <1s': 'Cut a reporting API from 40s to under 1s.',
      'mongodb → postgresql migration with a node.js etl pipeline':
        'Migrated MongoDB to PostgreSQL with a Node.js ETL pipeline.',
      'first job. vue.js 2 back-office screens for 1,600+ brazilian travel agencies':
        'First role: Vue.js 2 back-office screens for 1,600+ Brazilian travel agencies.',
    },
  },
  summary: {
    path: READING_PATHS.summary,
    title: `30s summary · ${profile.displayName}`,
    description: `${profile.displayName}, ${profile.title}. Stats, projects, work authorization, stack and contact on one screen.`,
    cvLinkLabel: 'VIEW_CV',
    statsLabel: 'Key numbers',
    experienceLabel: '8+ years',
    badge: 'OPEN_TO_RELOCATION · WORLDWIDE',
    projectNames: ['PAYMENT_ORCHESTRA', 'SERVICE_OPS_CONSOLE', 'AI_AGENT_MESH'],
    stack: [
      'REACT',
      'NEXT.JS',
      'TS',
      'NODE',
      'ANGULAR',
      'AWS',
      'POSTGRES',
      'PLAYWRIGHT',
      'A11Y',
      'CLAUDE',
    ],
    headings: {
      projects: 'Projects',
      workAuthorization: 'Work authorization',
      stack: 'Tech stack',
      contact: 'Contact',
    },
  },
});

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const toSentence = (fragment: string): string => {
  const key = fragment.trim().replace(TRAILING_PERIOD_PATTERN, '').toLowerCase();
  const override = readingViews.cv.proseOverrides[key];
  if (override) return override;
  const sentence = capitalise(fragment.trim());
  return TERMINAL_PUNCTUATION_PATTERN.test(sentence) ? sentence : `${sentence}.`;
};

const spaced = (label: string) => label.replaceAll(WORD_SEPARATOR, ' ');

const siteHref = social.site.replace(SITE_ORIGIN_PATTERN, '$1');
const siteLabel = siteHref.replace(PROTOCOL_PATTERN, '');

const labelOf = (key: string): string => {
  const label = readingViews.cv.credentialLabels[key];
  if (!label) throw new Error(`reading views: no CV label for credential "${key}"`);
  return label;
};

export const withoutFragment = (source: string, fragment: string): string => {
  if (!source.includes(fragment)) {
    throw new Error(
      `reading views: expected fragment missing from the README intro: "${fragment}"`,
    );
  }
  return source.replace(fragment, '');
};

const cvSummary = withoutFragment(
  withoutFragment(readmeCopy.desktopIntro, profileSummary),
  `${workAuthorizationProse}.`,
).trim();

export const cvDocument = CvDocumentSchema.parse({
  name: profile.displayName,
  role: profile.title,
  location: profileLocation,
  links: [
    { label: social.email, href: `mailto:${social.email}`, external: false },
    { label: siteLabel, href: siteHref, external: true },
    { label: 'LinkedIn', href: social.linkedin, external: true },
    { label: 'GitHub', href: social.github, external: true },
  ],
  summary: cvSummary,
  experience: gitLog.map((entry) => ({
    key: entry.hash,
    company: entry.company,
    meta: [
      entry.role,
      `${entry.location}${entry.workMode ? ` (${entry.workMode})` : ''}`,
      entry.date,
    ].join(STACK_SEPARATOR),
    bullets: entry.body
      .flatMap((line) => line.split(FRAGMENT_SEPARATOR_PATTERN))
      .filter((fragment) => fragment.trim().length > 0)
      .map(toSentence),
  })),
  skills: readmeCopy.desktopCoreStack
    .flatMap((line) => line.replace(BULLET_PREFIX_PATTERN, '').split(STACK_SEPARATOR))
    .map((item) => item.trim())
    .filter(Boolean),
  certifications: credentials.map((entry) => ({
    key: entry.label,
    label: labelOf(entry.label),
    value: [entry.badge, entry.evidence].join(STACK_SEPARATOR),
  })),
  community: {
    heading: [spaced(communityEvent.name), communityEvent.year, communityEvent.role].join(
      STACK_SEPARATOR,
    ),
    href: communityEvent.link.href,
    bullets: communityEvent.bullets.map(toSentence),
    status: toSentence(communityEvent.statusLine),
  },
  education: education.map((entry) => ({
    key: entry.id,
    label: entry.degree,
    value: [entry.institution, entry.location, entry.period].join(STACK_SEPARATOR),
  })),
  authorization: visaRows.map((row) => ({
    key: row.jurisdiction,
    label: row.jurisdiction,
    value: [row.status, row.evidence].join(STACK_SEPARATOR),
  })),
  languages: profile.languages
    .map((language) => `${language.code.toUpperCase()} (${language.level})`)
    .join(STACK_SEPARATOR),
  email: social.email,
});

const summaryProjects = readingViews.summary.projectNames.map((name) => {
  const project = projects.find((entry) => entry.name === name);
  const stat = project?.stats[0];
  if (!project || !stat) throw new Error(`reading views: project "${name}" has no stat to show`);
  return { name, label: stat.label, value: stat.value, description: project.description };
});

export const summaryDocument = SummaryDocumentSchema.parse({
  name: profile.displayName,
  tagline: profile.title,
  technologyLine: profile.technologyLine,
  context: [
    profileLocation,
    profile.currentEmployer.name,
    readingViews.summary.experienceLabel,
  ].join(STACK_SEPARATOR),
  stats: heroStats,
  projects: summaryProjects,
  authorization: visaRows,
  languages: cvDocument.languages,
  email: social.email,
});

const PROFILE_PAGE_TYPE = 'ProfilePage';

export const cvJsonLd = CvJsonLdSchema.parse({
  '@context': 'https://schema.org',
  '@type': PROFILE_PAGE_TYPE,
  url: `${social.site}${READING_PATHS.cv}`,
  name: readingViews.cv.title,
  mainEntity: {
    '@type': 'Person',
    name: profile.fullName,
    jobTitle: profile.title,
    url: social.site,
    sameAs: [social.linkedin, social.github],
  },
});
