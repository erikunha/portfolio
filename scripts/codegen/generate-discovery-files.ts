#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { communityEvent } from '../../content/community';
import { education } from '../../content/education';
import { gitLog } from '../../content/git-log';
import { OPEN_ROLES_SENTENCE } from '../../content/open-roles';
import {
  FUNDS_PHRASE,
  profile,
  profilePresentation,
  YEARS_OF_EXPERIENCE_LABEL,
} from '../../content/profile';
import { SITE_LOCALE } from '../../content/site-locale';
import { social } from '../../content/social';
import { PHONE_NUMBER } from '../../content/social-urls';
import { WORK_SCOPE } from '../../content/work-scope';
import { ASK_MAX_QUESTION_CHARS } from '../../lib/ask/limits';
import { isMain } from '../lib/is-main';
import {
  AI_ENGINEERING_LINES,
  AVAILABILITY_FOCUS,
  CERTIFICATIONS_LINES,
  COMMUNITY_LABEL,
  COMMUNITY_PAGES,
  DESIGN_SYSTEM_LINES,
  IMPACT_LINES,
  INDUSTRIES_LINES,
  LINK_COPY,
  LINK_PATH,
  MANIFEST_ASK,
  MANIFEST_COMMENT,
  MANIFEST_DESCRIPTION_TAIL,
  MANIFEST_MCP,
  MANIFEST_PROFILES,
  MANIFEST_SCHEMA_VERSION,
  PROJECT_CONTEXT_LINES,
  SKILLS_LINES,
  SUMMARY_LEAD_LINES,
} from './discovery-copy';

export const LLMS_TXT_PATH = 'public/llms.txt';
export const AGENT_MANIFEST_PATH = 'public/.well-known/agent.json';

const COMMAND = 'pnpm generate:discovery';
const CHECK_FLAG = '--check';
const LINE_BREAK = '\n';
const SECTION_BREAK = '\n\n';
const QUOTE_PREFIX = '> ';
const QUOTE_WRAP_WIDTH = 95;
const CONTINUATION_INDENT = '  ';
const JSON_INDENT = 2;
const FAILURE_EXIT_CODE = 1;
const FACT_SEPARATOR = ' · ';
const CURRENT_ROLE_PREFIX = 'working remotely for';
const QUOTE_MARK = '>';
const COMMUNITY_ROLE_PREFIX = ': ';

export interface ExperienceRow {
  period: string;
  company: string;
  role: string;
  location: string;
}

export interface DiscoverySource {
  fullName: string;
  displayName: string;
  title: string;
  yearsLabel: string;
  country: string;
  city: string;
  timezone: string;
  availability: string;
  summary: string;
  location: string;
  employerName: string;
  employerContext: string;
  employerLocation: string;
  technologyLine: string;
  fundsPhrase: string;
  workScope: string;
  openRoles: string;
  email: string;
  phone: string;
  siteUrl: string;
  siteLabel: string;
  githubUrl: string;
  linkedinUrl: string;
  experience: readonly ExperienceRow[];
  education: readonly string[];
  languages: readonly string[];
  community: {
    label: string;
    year: number;
    role: string;
    talks: string;
    linkUrl: string;
    statusLine: string;
  };
}

const english = SITE_LOCALE.en;

const experienceRow = (entry: (typeof gitLog)[typeof english][number]): ExperienceRow => {
  const company = entry.companyUrl ? `[${entry.company}](${entry.companyUrl})` : entry.company;
  const location = entry.workMode ? `${entry.location} (${entry.workMode})` : entry.location;
  return { period: entry.date, company, role: entry.role, location };
};

const educationLine = (entry: (typeof education)[typeof english][number]): string => {
  const place = entry.studyMode ? `${entry.location} (${entry.studyMode})` : entry.location;
  const period = entry.expectedCompletion ? `, ${entry.period}` : ` (${entry.period})`;
  return `${entry.degree}, ${entry.institution}, ${place}${period}`;
};

export function buildDiscoverySource(): DiscoverySource {
  const presentation = profilePresentation[english];
  const [current] = gitLog[english];
  const event = communityEvent[english];
  return {
    fullName: profile.fullName,
    displayName: profile.displayName,
    title: presentation.title,
    yearsLabel: YEARS_OF_EXPERIENCE_LABEL,
    country: presentation.country,
    city: profile.city,
    timezone: profile.timezone,
    availability: presentation.availability,
    summary: presentation.summary,
    location: presentation.location,
    employerName: profile.currentEmployer.name,
    employerContext: presentation.employerContext,
    employerLocation: current?.location ?? '',
    technologyLine: profile.technologyLine,
    fundsPhrase: FUNDS_PHRASE,
    workScope: WORK_SCOPE[english],
    openRoles: OPEN_ROLES_SENTENCE[english],
    email: social.email,
    phone: PHONE_NUMBER,
    siteUrl: social.site,
    siteLabel: social.siteLabel,
    githubUrl: social.github,
    linkedinUrl: social.linkedin,
    experience: gitLog[english].map(experienceRow),
    education: education[english].map(educationLine),
    languages: profile.languages.map((language) => `${language.name}: ${language.level}`),
    community: {
      label: COMMUNITY_LABEL,
      year: event.year,
      role: event.role.toLowerCase(),
      talks: event.bullets[0] ?? '',
      linkUrl: event.link.href,
      statusLine: event.statusLine,
    },
  };
}

const wrap = (text: string, width: number): string[] => {
  const lines: string[] = [];
  let line = QUOTE_MARK;
  for (const word of text.split(' ')) {
    const next = `${line} ${word}`;
    if (next.length > width) {
      lines.push(line);
      line = `${QUOTE_MARK} ${word}`;
    } else {
      line = next;
    }
  }
  lines.push(line);
  return lines;
};

const headerSection = (source: DiscoverySource): string => {
  const [leadFirst = '', leadSecond = '', leadThird = ''] = SUMMARY_LEAD_LINES;
  const wrapped = wrap(
    `${leadThird} ${source.location}. Currently at ${source.employerName}: ${source.employerContext}.`,
    QUOTE_WRAP_WIDTH,
  );
  const last = wrapped.length - 1;
  wrapped[last] = `${wrapped[last]} ${source.technologyLine}.`;
  return [
    `# ${source.displayName}${FACT_SEPARATOR}${source.title}`,
    '',
    `${QUOTE_PREFIX}${source.title}. ${source.yearsLabel} ${leadFirst}`,
    `${QUOTE_PREFIX}${leadSecond}`,
    ...wrapped,
    `${QUOTE_PREFIX}Investor workflow screens for ${source.fundsPhrase}.`,
  ].join(LINE_BREAK);
};

const availabilitySection = (source: DiscoverySource): string =>
  [
    '## Availability',
    '',
    `- Status: ${source.availability}`,
    `- Location: ${source.city}, ${source.country} (${source.timezone})`,
    `- Current role: ${CURRENT_ROLE_PREFIX} ${source.employerName} (${source.employerLocation})`,
    `- Work scope: ${source.workScope}`,
    `- Target role: ${source.title}`,
    `- Open to roles: ${source.openRoles}`,
    `- Focus: ${AVAILABILITY_FOCUS}`,
    `- Contact: ${source.email} | ${source.phone}`,
  ].join(LINE_BREAK);

const staticSection = (heading: string, lines: readonly string[]): string =>
  [`## ${heading}`, '', ...lines].join(LINE_BREAK);

const experienceSection = (source: DiscoverySource): string =>
  [
    '## Professional Experience',
    '',
    '| Period | Company | Role | Location |',
    '|---|---|---|---|',
    ...source.experience.map(
      (row) => `| ${row.period} | ${row.company} | ${row.role} | ${row.location} |`,
    ),
  ].join(LINE_BREAK);

const listSection = (heading: string, items: readonly string[]): string =>
  [`## ${heading}`, '', ...items.map((item) => `- ${item}`)].join(LINE_BREAK);

const communitySection = (source: DiscoverySource): string => {
  const { community } = source;
  const base = community.linkUrl.slice(
    0,
    community.linkUrl.lastIndexOf('/', community.linkUrl.length - 2) + 1,
  );
  const talks = `${community.talks.charAt(0).toUpperCase()}${community.talks.slice(1)}`;
  return [
    '## Community',
    '',
    `- ${community.label} ${community.year}${COMMUNITY_ROLE_PREFIX}${community.role} (${community.linkUrl})`,
    `${CONTINUATION_INDENT}${talks}`,
    `${CONTINUATION_INDENT}Program: ${base}${COMMUNITY_PAGES.program}`,
    `${CONTINUATION_INDENT}Organizers: ${base}${COMMUNITY_PAGES.organizers}`,
    `- ${community.statusLine}`,
  ].join(LINE_BREAK);
};

const linksSection = (source: DiscoverySource): string => {
  const target: Record<(typeof LINK_COPY)[number]['target'], string> = {
    site: source.siteUrl,
    cv: `${source.siteUrl}${LINK_PATH.cv}`,
    cvPdf: `${source.siteUrl}${LINK_PATH.cvPdf}`,
    cvPdfPt: `${source.siteUrl}${LINK_PATH.cvPdfPt}`,
    github: source.githubUrl,
    linkedin: source.linkedinUrl,
    profileApi: `${source.siteUrl}${LINK_PATH.profileApi}`,
  };
  const items = LINK_COPY.map((link) => {
    const [first = '', ...rest] = link.description;
    return [
      `- [${link.label}](${target[link.target]}): ${first}`,
      ...rest.map((line) => `${CONTINUATION_INDENT}${line}`),
    ].join(LINE_BREAK);
  });
  return ['## Links', '', ...items].join(LINE_BREAK);
};

export function renderLlmsTxt(source: DiscoverySource): string {
  const sections = [
    headerSection(source),
    availabilitySection(source),
    staticSection('AI Engineering', AI_ENGINEERING_LINES),
    staticSection('Impact at Scale', IMPACT_LINES),
    staticSection('Technical Skills', SKILLS_LINES),
    experienceSection(source),
    staticSection('Industries', INDUSTRIES_LINES),
    listSection('Education', source.education),
    staticSection('Certifications', CERTIFICATIONS_LINES),
    listSection('Languages', source.languages),
    communitySection(source),
    staticSection('Selected project context', PROJECT_CONTEXT_LINES),
    linksSection(source),
    staticSection('Design System', DESIGN_SYSTEM_LINES),
  ];
  return `${sections.join(SECTION_BREAK)}${LINE_BREAK}`;
}

export function renderAgentManifest(source: DiscoverySource): string {
  const url = (path: string) => `${source.siteUrl}${path}`;
  const manifest = {
    $comment: MANIFEST_COMMENT,
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    name: `${source.displayName}${FACT_SEPARATOR}portfolio agent surface`,
    description: `Machine-readable capability manifest for ${source.siteLabel}, the portfolio of ${source.displayName}, ${source.summary} ${MANIFEST_DESCRIPTION_TAIL}`,
    url: source.siteUrl,
    provider: { name: source.fullName, url: source.siteUrl, contact: source.email },
    endpoints: [
      {
        name: MANIFEST_ASK.name,
        description: MANIFEST_ASK.description,
        url: url(LINK_PATH.ask),
        method: MANIFEST_ASK.method,
        input: {
          contentType: MANIFEST_ASK.inputContentType,
          schema: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: MANIFEST_ASK.questionDescription,
                maxLength: ASK_MAX_QUESTION_CHARS,
              },
            },
            required: ['question'],
          },
        },
        output: {
          contentType: MANIFEST_ASK.outputContentType,
          streaming: true,
          description: MANIFEST_ASK.outputDescription,
        },
        rateLimit: MANIFEST_ASK.rateLimit,
      },
    ],
    profiles: MANIFEST_PROFILES.map((entry) => ({
      name: entry.name,
      description: entry.description,
      url: url(entry.path),
      contentType: entry.contentType,
    })),
    mcp: {
      name: MANIFEST_MCP.name,
      description: MANIFEST_MCP.description,
      url: url(LINK_PATH.mcp),
      transport: MANIFEST_MCP.transport,
      tools: MANIFEST_MCP.tools,
    },
    title: source.title,
    location: source.country,
    timezone: source.timezone,
    availability: source.availability,
  };
  return `${JSON.stringify(manifest, null, JSON_INDENT)}${LINE_BREAK}`;
}

export function renderDiscoveryFiles(
  source: DiscoverySource = buildDiscoverySource(),
): Record<string, string> {
  return {
    [LLMS_TXT_PATH]: renderLlmsTxt(source),
    [AGENT_MANIFEST_PATH]: renderAgentManifest(source),
  };
}

export function findStaleDiscoveryFiles(read: (path: string) => string): string[] {
  return Object.entries(renderDiscoveryFiles())
    .filter(([path, expected]) => read(path) !== expected)
    .map(([path]) => path);
}

if (isMain(import.meta.url)) {
  const root = join(import.meta.dirname, '../..');
  if (process.argv.includes(CHECK_FLAG)) {
    const stale = findStaleDiscoveryFiles((path) => readFileSync(join(root, path), 'utf8'));
    if (stale.length > 0) {
      console.error(`${stale.join(', ')} stale: run \`${COMMAND}\` and commit the result`);
      process.exit(FAILURE_EXIT_CODE);
    }
  } else {
    for (const [path, text] of Object.entries(renderDiscoveryFiles())) {
      writeFileSync(join(root, path), text);
    }
  }
}
