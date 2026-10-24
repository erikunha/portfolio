import { z } from 'zod';
import { credentials } from '@/content/credentials';
import { education } from '@/content/education';
import { gitLog } from '@/content/git-log';
import { perfReceipts } from '@/content/perf-receipts';
import { profile, profileLocation } from '@/content/profile';
import { projects } from '@/content/projects';
import { PerfReceiptSchema, ProjectSchema } from '@/content/schemas';
import { workAuthorization } from '@/content/visa';

const EmployerSchema = z.object({
  name: z.string(),
  role: z.string(),
  domain: z.string(),
  current: z.boolean().optional(),
  dates: z.string(),
});

const LanguageSchema = z.object({
  code: z.string(),
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
  projects: z.array(ProjectSchema),
  performance_receipts: z.array(PerfReceiptSchema),
  work_auth: z.record(z.string(), z.string()),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      location: z.string(),
      years: z.string(),
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

export const HIRING_PROFILE: HiringProfile = HiringProfileSchema.parse({
  '@type': 'HiringProfile',
  name: profile.fullName,
  alias: profile.displayName,
  title: profile.title,
  timezone: profile.timezone,
  url: 'https://www.erikunha.dev',
  email: 'erikhenriquealvescunha@gmail.com',
  github: 'https://github.com/erikunha',
  linkedin: 'https://www.linkedin.com/in/erikunha/',

  seniority: ['senior', 'staff', 'principal'],
  yoe: 8,

  stack_primary: ['React', 'Next.js', 'TypeScript', 'Angular', 'RxJS', 'NgRx'],
  stack_secondary: [
    'Node.js',
    'Express.js',
    'PostgreSQL',
    'MongoDB',
    'Docker',
    'AWS',
    'GitHub Actions',
  ],
  domains: [
    'AI deal origination / private markets',
    'fintech',
    'PCI-DSS',
    'healthcare',
    'e-commerce',
    'edtech',
    'banking',
    'highway-ops',
  ],

  employers: gitLog.map((entry) => ({
    name: entry.company,
    role: entry.role,
    domain: entry.domain,
    current: entry.endMonth === null,
    dates: entry.date,
  })),

  receipts: {
    tx_volume_per_year: '40M+',
    revenue_platform: '€1.197B group revenue (Betsson Group)',
    mau_peak: '8M+ (Grupo SBF)',
    a11y_score: '~100/100',
    perf_delta_js: '-33%',
    perf_delta_css: '-98%',
    tti_improvement: '-52%',
    page_load_reduction: '-32%',
    conversion_uplift: '+10% (20+ A/B experiments)',
    api_latency_reduction: '-97.5% (40s→<1s, Venturus)',
    onboarding_reduction: '-40% (Betsson, 35-page knowledge system)',
    labs_delivered: '2.1M+ cumulative (VMware Pathfinder)',
    banking_customers: '70M+ (Itaú via Zup)',
    copilot_subagents: '12-agent system (Betsson)',
  },

  projects,
  performance_receipts: perfReceipts,

  work_auth: workAuthorization,
  education: education.map((entry) => ({
    institution: entry.institution,
    degree: entry.degree,
    location: entry.studyMode ? `${entry.location} (${entry.studyMode})` : entry.location,
    years: entry.period,
  })),
  certifications: credentials.map((entry) => `${entry.label} · ${entry.badge} · ${entry.evidence}`),
  availability: profile.availability,
  notice_period_days: 0,
  open_to: ['full_time', 'contract', 'ic', 'tech_lead', 'staff', 'principal'],
  location: profileLocation,

  languages: profile.languages,
  last_updated: '2026-07-11',
});
