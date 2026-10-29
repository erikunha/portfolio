import { CV_LINK_LABEL, READING_PATHS } from './reading-paths';
import { CareerCopySchema, type GitCommit, GitCommitSchema } from './schemas';

export const gitLog: GitCommit[] = GitCommitSchema.array().parse([
  {
    hash: 'b2e6a19f4c8d3057e1a9b6c2d8f40e73a5c1908d',
    deco: '(HEAD -> main, tag: v9.0)',
    date: 'Jun 2026 - Present',
    branch: 'career/raylu',
    type: 'career',
    company: 'Raylu',
    role: 'Senior Software Engineer, Frontend & Product (contract via Torc)',
    startMonth: '2026-06',
    endMonth: null,
    location: 'New York, US',
    workMode: 'remote',
    domain: 'private-markets fintech · B2B SaaS',
    body: [
      'wanted AI-native product scale; rebuilt the investor workflow screens of a private-markets platform for 50+ funds holding $500B+ in assets.',
    ],
  },
  {
    hash: '7f3a2bc09f8e1d4c2b6a5d3e8c1f2a7b9d4e6c0a',
    deco: '(tag: v8.0)',
    date: 'Mar 2025 - May 2026',
    branch: 'career/betsson',
    type: 'career',
    company: 'Betsson Group',
    role: 'Senior Software Engineer, Frontend',
    startMonth: '2025-03',
    endMonth: '2026-05',
    location: 'Malta',
    workMode: 'hybrid',
    domain: 'online gaming and payments',
    body: [
      'wanted regulated multi-market scale; got 40M+ tx/yr across 15+ jurisdictions on a PCI-DSS payment platform.',
    ],
  },
  {
    hash: '4a9e1d886b3f2c7e0a8d5b9c1e6f4a2b3d7e8c01',
    deco: '(tag: v7.0)',
    date: 'Mar 2023 - Mar 2025',
    branch: 'career/canon-medical',
    type: 'career',
    company: 'Canon Medical Systems',
    role: 'Senior Software Engineer, Frontend (independent consultant)',
    startMonth: '2023-03',
    endMonth: '2025-03',
    location: 'Canada',
    workMode: 'remote',
    domain: 'healthcare technology',
    body: [
      'rebuilt a hospital equipment service platform: service orders, specialist schedules, field visits; Angular 17 to 19.',
    ],
  },
  {
    hash: '5b6f0a4c8d9e1b3a7c2f5d8b0a4e6c9f1b3d7a02',
    deco: '(tag: v6.0)',
    date: 'Dec 2021 - Mar 2023',
    branch: 'career/grupo-sbf',
    type: 'career',
    company: 'Grupo SBF (Nike / Centauro)',
    role: 'Software Engineer, Frontend',
    startMonth: '2021-12',
    endMonth: '2023-03',
    location: 'São Paulo, Brazil',
    workMode: 'remote',
    domain: 'sports retail e-commerce',
    body: [
      'Next.js storefronts for Nike Brazil and Centauro (8M+ MAU); lifted conversion ~10% through 20+ A/B experiments.',
    ],
  },
  {
    hash: '3d4e8c1a5b9f2c7e6d3a8b1c4e5f9d2a7b6c0e8d',
    deco: '(tag: v5.0)',
    date: 'Jan 2021 - Dec 2021',
    branch: 'career/encora',
    type: 'career',
    company: 'Encora (formerly Daitan)',
    role: 'Software Engineer, Frontend · assigned to VMware',
    startMonth: '2021-01',
    endMonth: '2021-12',
    location: 'Campinas, Brazil',
    workMode: null,
    domain: 'enterprise cloud software',
    body: ['VMware Pathfinder lab portal on Angular 11; NgRx effects, Reactive Forms, 2.1M+ labs.'],
  },
  {
    hash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a01',
    deco: '(tag: v4.0)',
    date: 'Apr 2020 - Jan 2021',
    branch: 'career/zup-itau',
    type: 'career',
    company: 'ZUP Innovation (Itaú Unibanco)',
    role: 'Software Engineer, Frontend',
    startMonth: '2020-04',
    endMonth: '2021-01',
    location: 'Campinas, Brazil',
    workMode: null,
    domain: 'business insurance',
    body: [
      "first regulated / banking work; Angular Elements micro-frontends for Itaú's business insurance (24.2M digital clients).",
    ],
  },
  {
    hash: '9c8b7a6e5d4f3c2b1a0e9d8c7b6a5e4f3d2c1b0a',
    deco: '(tag: v3.0)',
    date: 'Feb 2019 - Apr 2020',
    branch: 'career/venturus',
    type: 'career',
    company: 'Venturus',
    role: 'Full-Stack Software Engineer → Software Engineer, Frontend',
    startMonth: '2019-02',
    endMonth: '2020-04',
    location: 'Campinas, Brazil',
    workMode: null,
    domain: 'applied R&D',
    body: [
      'cut teeth on backend; reporting API 40s → <1s; MongoDB → PostgreSQL migration with a Node.js ETL pipeline.',
    ],
  },
  {
    hash: '0e0f0a0b0c0d0e0f0a0b0c0d0e0f0a0b0c0d0e0f',
    deco: '(tag: v2.0)',
    date: 'Jul 2018 - Feb 2019',
    branch: 'career/mb-labs',
    type: 'career',
    company: 'MB Labs',
    role: 'Full-Stack Software Engineer → Software Engineer, Cross-Platform',
    startMonth: '2018-07',
    endMonth: '2019-02',
    location: 'Campinas, Brazil',
    workMode: null,
    domain: 'education and retail training',
    body: [
      'shipped 5-OS cross-platform from one Ionic + Angular + Electron codebase (~80% shared code).',
    ],
  },
  {
    hash: '0d1c2b3a4e5f67890123456789abcdef01234567',
    deco: '(tag: v1.0, root-commit)',
    date: 'Oct 2017 - May 2018',
    branch: 'career/monde-sistemas',
    type: 'career',
    company: 'Monde Sistemas',
    role: 'Software Engineer Intern, Frontend',
    startMonth: '2017-10',
    endMonth: '2018-05',
    location: 'Americana, Brazil',
    workMode: null,
    domain: 'travel technology',
    body: ['first job. Vue.js 2 back-office screens for 1,600+ Brazilian travel agencies.'],
    isRoot: true,
  },
]);

const GRAPH_CONTINUATION_LINES = 80;
const SHORT_HASH_LENGTH = 7;

export const careerCopy = CareerCopySchema.parse({
  heading: 'Career',
  headerCommand: 'GIT LOG --ONELINE --DECORATE --GRAPH',
  mobileHeaderCommand: 'GIT LOG --ONELINE',
  prompt: 'erik@portfolio:~$',
  command: 'git log --oneline --decorate --graph ~/career',
  cvLabel: CV_LINK_LABEL,
  cvHref: READING_PATHS.cv,
  scrollLabel: 'Career history, scrollable',
  pipe: '|',
  graph: `*\n${'|\n'.repeat(GRAPH_CONTINUATION_LINES)}`,
});

export const careerCommand = careerCopy.command;
export const careerScrollLabel = careerCopy.scrollLabel;

const COMPANY_SEPARATOR = ' ';
const COMPANY_JOINER = '_';
const COMPANY_DETAIL_SEPARATOR = ' (';
const COUNTRY_LABELS = { full: ', Brazil', short: ', BR' } as const;

export const careerEntries = gitLog.map((entry) => {
  const [name, ...details] = entry.company.split(COMPANY_DETAIL_SEPARATOR);
  const company = [name?.replaceAll(COMPANY_SEPARATOR, COMPANY_JOINER), ...details].join(
    COMPANY_DETAIL_SEPARATOR,
  );
  return {
    ...entry,
    shortHash: entry.hash.slice(0, SHORT_HASH_LENGTH),
    displayCompany: company.toUpperCase(),
    displayRole: entry.role.toUpperCase(),
    displayLocation: `${entry.location.replace(COUNTRY_LABELS.full, COUNTRY_LABELS.short)}${entry.workMode ? ` (${entry.workMode})` : ''}`,
  };
});
