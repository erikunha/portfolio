import { z } from 'zod';
import {
  PROJECT_ID as ID,
  PROJECT_KIND as KIND,
  PERF_METRIC as METRIC,
  ProjectSchema,
} from './schemas';

export const projectSectionCopy = {
  header: 'LS -LA ./PROJECTS',
  mobileHeader: 'LS -LA ~/PROJECTS',
  stackLabel: 'STACK',
  newTabDisclosure: ' (opens in a new tab)',
} as const;

export const projectAnchor = (id: z.infer<typeof ProjectSchema>['id']) => `project-${id}`;

export const projects = z
  .array(ProjectSchema)
  .parse([
    {
      id: ID.ORIGINATION,
      company: 'Raylu',
      kind: KIND.CORPORATE,
      name: 'ORIGINATION_PLATFORM_UI',
      description:
        "Investor workflow screens on Raylu's private-markets platform: company, pipeline, comparison, outreach. Shared table engine and URL-backed view state for funds holding $500B+ in assets.",
      stack: ['React', 'Next.js 14', 'TypeScript 5'],
      stats: [
        {
          label: 'SURFACES',
          value: 'COMPANY / PIPELINE / OUTREACH',
        },
        {
          label: 'STATE',
          value: 'VERSIONED + URL-BACKED',
        },
      ],
      order: 1,
    },
    {
      id: ID.PAYMENTS,
      company: 'Betsson Group',
      kind: KIND.CORPORATE,
      name: 'PAYMENT_ORCHESTRA',
      description:
        'PCI-DSS cashier platform: multi-brand deposit/withdraw orchestration across 15+ regulated jurisdictions.',
      stack: ['ANGULAR', 'STENCIL', 'NGRX', 'NX'],
      stats: [
        {
          label: 'VOLUME',
          value: '40M+ TX / YR',
        },
        {
          label: 'REVENUE',
          value: '€1.197B (GROUP)',
        },
      ],
      order: 2,
    },
    {
      id: ID.SERVICE,
      company: 'Canon Medical Systems',
      kind: KIND.CORPORATE,
      name: 'SERVICE_OPS_CONSOLE',
      description:
        'Hospital equipment service platform: service orders, specialist schedules, field visits, live updates. Clean Architecture.',
      stack: ['ANGULAR', 'NX', 'RXJS'],
      stats: [
        {
          label: 'JS BUNDLE',
          value: '-33%',
          metric: METRIC.BUNDLE_JS,
        },
        {
          label: 'TTI',
          value: '-52%',
          metric: METRIC.TTI,
        },
      ],
      order: 3,
    },
    {
      id: ID.COMMERCE,
      company: 'Grupo SBF (Nike / Centauro)',
      kind: KIND.CORPORATE,
      name: 'COMMERCE_EDGE',
      description:
        'Nike Brazil & Centauro storefronts: SSR/SSG/ISR, BFF gateway, shared Nx monorepo, 20+ A/B experiments.',
      stack: ['NEXT.JS', 'REACT', 'TS'],
      stats: [
        {
          label: 'REACH',
          value: '8M+ MAU',
        },
        {
          label: 'LOAD TIME',
          value: '-32%',
          metric: METRIC.PAGE_LOAD,
        },
      ],
      order: 4,
    },
    {
      id: ID.AI_MESH,
      company: 'Betsson Group',
      kind: KIND.CORPORATE,
      name: 'AI_AGENT_MESH',
      description:
        'GitHub Copilot 12-agent engineering system: generation, review, debugging, testing, architecture validation. Every automated action reviewable. Adopted team-wide at Betsson.',
      stack: ['GITHUB COPILOT'],
      stats: [
        {
          label: 'AGENTS',
          value: '12',
        },
        {
          label: 'SCOPE',
          value: 'TEAM-WIDE',
        },
      ],
      order: 5,
      perm: '-rwx------',
    },
    {
      id: ID.EDTECH,
      company: 'MB Labs',
      kind: KIND.CORPORATE,
      name: 'EDTECH_OMNI',
      description:
        'Cross-platform EdTech app: one codebase, five OSes (Android / iOS / Win / macOS / Linux).',
      stack: ['IONIC', 'ANGULAR', 'ELECTRON'],
      stats: [
        {
          label: 'SHARED',
          value: '~80% CODE',
        },
        {
          label: 'DESKTOP BUILD',
          value: '-40%',
          metric: METRIC.DESKTOP_BUILD,
        },
      ],
      order: 6,
    },
    {
      id: ID.GOOGLE_MAPS,
      company: 'react-google-maps-api',
      kind: KIND.OSS,
      name: 'REACT_GOOGLE_MAPS_API',
      description:
        'Fixed an infinite React re-render loop in the Directions API example. The loop cost the docs site 61K+ unwanted Google Maps API calls. Stable-callback fix, merged by the maintainer.',
      stack: ['React', 'TypeScript', 'Google Maps API'],
      stats: [
        {
          label: 'LIBRARY',
          value: '~1.8M WEEKLY NPM DOWNLOADS',
        },
        {
          label: 'ROOT CAUSE',
          value: 'NEW CALLBACK IDENTITY EVERY RENDER',
        },
        {
          label: 'STATUS',
          value: 'MERGED',
        },
      ],
      order: 7,
      href: 'https://github.com/JustFly1984/react-google-maps-api/pull/3266',
    },
    {
      id: ID.PORTFOLIO,
      company: 'Erik Cunha',
      kind: KIND.OSS,
      name: 'ERIKUNHA.DEV',
      description:
        'This portfolio. Next.js 16 App Router, React 19, RSC-first, a streaming Anthropic endpoint on the Vercel AI SDK, and a CI eval harness that decides if it ships.',
      stack: ['Next.js 16', 'React 19', 'TypeScript', 'Vercel AI SDK'],
      stats: [
        {
          label: 'LCP BUDGET',
          value: '< 1.8s',
        },
        {
          label: 'INP BUDGET',
          value: '< 200ms',
        },
        {
          label: 'DECISION LOG',
          value: '130+ RECORDS',
        },
      ],
      order: 8,
      href: 'https://github.com/erikunha/portfolio',
    },
    {
      id: ID.LAIBEMAGE,
      company: 'Erik Cunha',
      kind: KIND.OSS,
      name: 'LAIBEMAGE',
      description:
        'Open-source TypeScript CLI (MIT) classifying images across seven LLM vision providers: self-elicited confidence, local-to-cloud escalation below 0.70, two-provider consensus, active-learning queue.',
      stack: ['TypeScript', 'Node.js'],
      stats: [
        {
          label: 'PROVIDERS',
          value: '7',
        },
        {
          label: 'CI',
          value: '8 WORKFLOWS',
        },
        {
          label: 'GATE',
          value: '5% REGRESSION',
        },
      ],
      order: 9,
      href: 'https://github.com/erikunha/LAIbemage',
    },
  ])
  .sort((left, right) => left.order - right.order);
