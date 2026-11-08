import { z } from 'zod';
import { credentials } from '@/content/credentials';
import { education } from '@/content/education';
import { gitLog } from '@/content/git-log';
import {
  PROFILE_FACT,
  profile,
  profileLocation,
  receiptDelta,
  receiptDisplayValue,
  YEARS_OF_EXPERIENCE,
} from '@/content/profile';
import { SITE_LOCALE } from '@/content/site-locale';
import { social } from '@/content/social';

const EmployerSchema = z.object({
  name: z.string(),
  url: z.url(),
  role: z.string(),
  domain: z.string(),
  current: z.boolean().optional(),
  dates: z.string(),
});

const LanguageSchema = z.object({
  code: z.string(),
  label: z.string(),
  name: z.string(),
  level: z.string(),
});

export const HiringProfileSchema = z.object({
  '@type': z.literal('HiringProfile'),
  name: z.string(),
  alias: z.string(),
  title: z.string(),
  timezone: z.string(),
  url: z.string().url(),
  email: z.string().email(),
  github: z.string().url(),
  linkedin: z.string().url(),
  seniority: z.array(z.string()),
  yoe: z.number().int().positive(),
  stack_primary: z.array(z.string()),
  stack_secondary: z.array(z.string()),
  domains: z.array(z.string()),
  employers: z.array(EmployerSchema),
  receipts: z.record(z.string(), z.string()),
  work_auth: z.record(z.string(), z.string()),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      location: z.string(),
      years: z.string(),
      expected_completion: z.string().nullable(),
    }),
  ),
  certifications: z.array(z.string()),
  availability: z.string(),
  notice_period_days: z.number().int().nonnegative(),
  open_to: z.array(z.string()),
  location: z.string(),
  languages: z.array(LanguageSchema),
  last_updated: z.string(),
});

export type HiringProfile = z.infer<typeof HiringProfileSchema>;

const BUILD_DATE_MESSAGE = 'BUILD_DATE must be a YYYY-MM-DD date baked in by next.config.ts';
const BUILD_DATE = z.iso.date(BUILD_DATE_MESSAGE).parse(process.env.BUILD_DATE);

export const HIRING_PROFILE: HiringProfile = HiringProfileSchema.parse({
  '@type': 'HiringProfile',
  name: profile.fullName,
  alias: profile.displayName,
  title: profile.title,
  timezone: profile.timezone,
  url: social.site,
  email: social.email,
  github: social.github,
  linkedin: social.linkedin,

  seniority: ['senior'],
  yoe: YEARS_OF_EXPERIENCE,

  stack_primary: ['TypeScript', 'Python', 'React', 'Next.js', 'Angular', 'Node.js'],
  stack_secondary: [
    'RxJS',
    'NgRx',
    'Express.js',
    'PostgreSQL',
    'MongoDB',
    'Docker',
    'AWS',
    'GitHub Actions',
  ],
  domains: [
    'applied AI',
    'LLM evaluation',
    'private markets deal origination',
    'fintech',
    'PCI-DSS',
    'healthcare',
    'e-commerce',
    'edtech',
    'banking',
    'highway-ops',
  ],

  employers: gitLog[SITE_LOCALE.en].map((entry) => ({
    name: entry.company,
    url: entry.companyUrl,
    role: entry.role,
    domain: entry.domain,
    current: entry.endMonth === null,
    dates: entry.date,
  })),

  receipts: {
    tx_volume_per_year: PROFILE_FACT.txPerYear,
    revenue_platform: `${PROFILE_FACT.groupRevenue} group revenue (Betsson)`,
    mau_peak: `${PROFILE_FACT.peakMau} (Grupo SBF)`,
    a11y_score: '~100/100',
    perf_delta_js: receiptDelta('BUNDLE_JS'),
    perf_delta_css: receiptDelta('BUNDLE_CSS'),
    tti_improvement: receiptDelta('TTI'),
    page_load_reduction: receiptDelta('PAGE_LOAD'),
    conversion_uplift: `${receiptDelta('CONVERSION')} (20+ A/B experiments)`,
    api_latency_reduction: `${receiptDelta('API_LATENCY')} (${receiptDisplayValue('API_LATENCY')}, Venturus)`,
    labs_delivered: `${PROFILE_FACT.labsDelivered} cumulative (VMware Pathfinder)`,
    banking_customers: `${PROFILE_FACT.bankingClients} digital clients (Itaú via Zup)`,
    copilot_subagents: '12-agent system (Betsson)',
  },

  work_auth: {},
  education: education[SITE_LOCALE.en].map((entry) => ({
    institution: entry.institution,
    degree: entry.degree,
    location: entry.studyMode ? `${entry.location} (${entry.studyMode})` : entry.location,
    years: entry.period,
    expected_completion: entry.expectedCompletion,
  })),
  certifications: credentials.map((entry) => `${entry.label} · ${entry.badge} · ${entry.evidence}`),
  availability: profile.availability,
  notice_period_days: 0,
  open_to: ['full_time', 'contract', 'ic', 'tech_lead'],
  location: profileLocation,

  languages: profile.languages,
  last_updated: BUILD_DATE,
});
