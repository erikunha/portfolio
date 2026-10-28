import { z } from 'zod';
import { type Project, ProjectSchema } from './schemas';

export const projectPresentation = z
  .object({
    command: z.string().min(1),
    mobileCommand: z.string().min(1),
    permissions: z.string().min(1),
    externalDisclosure: z.string().min(1),
  })
  .parse({
    command: 'LS -LA ./PROJECTS',
    mobileCommand: 'LS -LA ~/PROJECTS',
    permissions: 'drwxr-xr-x',
    externalDisclosure: '(opens in a new tab)',
  });

export const projects: Project[] = z
  .array(ProjectSchema)
  .length(9)
  .parse([
    {
      name: 'ORIGINATION_PLATFORM_UI',
      company: 'Raylu',
      kind: 'professional',
      description:
        "Investor workflow screens on Raylu's private-markets platform: company, pipeline, comparison, outreach. Shared table engine and URL-backed view state for funds holding $500B+ in assets.",
      stats: [
        { label: 'SURFACES', value: 'COMPANY / PIPELINE / OUTREACH' },
        { label: 'STATE', value: 'VERSIONED + URL-BACKED' },
        { label: 'STACK', value: 'React / Next.js 14 / TypeScript 5' },
      ],
    },
    {
      name: 'PAYMENT_ORCHESTRA',
      company: 'Betsson Group',
      kind: 'professional',
      description:
        'PCI-DSS cashier platform: multi-brand deposit/withdraw orchestration across 15+ regulated jurisdictions.',
      stats: [
        { label: 'VOLUME', value: '40M+ TX / YR' },
        { label: 'REVENUE', value: '€1.197B (GROUP)' },
        { label: 'STACK', value: 'ANGULAR / STENCIL / NGRX / NX' },
      ],
    },
    {
      name: 'SERVICE_OPS_CONSOLE',
      company: 'Canon Medical Systems',
      kind: 'professional',
      mobileName: 'service_ops/',
      description:
        'Hospital equipment service platform: service orders, specialist schedules, field visits, live updates. Clean Architecture.',
      stats: [
        { label: 'JS BUNDLE', value: '-33%' },
        { label: 'TTI', value: '-52%' },
        { label: 'STACK', value: 'ANGULAR / NX / RXJS' },
      ],
    },
    {
      name: 'COMMERCE_EDGE',
      company: 'Grupo SBF',
      kind: 'professional',
      description:
        'Nike Brazil & Centauro storefronts: SSR/SSG/ISR, BFF gateway, shared Nx monorepo, 20+ A/B experiments.',
      stats: [
        { label: 'REACH', value: '8M+ MAU' },
        { label: 'LOAD TIME', value: '-32%' },
        { label: 'STACK', value: 'NEXT.JS / REACT / TS' },
      ],
    },
    {
      name: 'AI_AGENT_MESH',
      company: 'Betsson Group',
      kind: 'professional',
      perm: '-rwx------',
      description:
        'GitHub Copilot 12-agent engineering system: generation, review, debugging, testing, architecture validation. Every automated action reviewable. Adopted team-wide at Betsson.',
      stats: [
        { label: 'AGENTS', value: '12' },
        { label: 'SCOPE', value: 'TEAM-WIDE' },
        { label: 'STACK', value: 'GITHUB COPILOT' },
      ],
    },
    {
      name: 'EDTECH_OMNI',
      company: 'MB Labs',
      kind: 'professional',
      description:
        'Cross-platform EdTech app: one codebase, five OSes (Android / iOS / Win / macOS / Linux).',
      stats: [
        { label: 'SHARED', value: '~80% CODE' },
        { label: 'DESKTOP BUILD', value: '-40%' },
        { label: 'STACK', value: 'IONIC / ANGULAR / ELECTRON' },
      ],
    },
    {
      name: 'REACT_GOOGLE_MAPS_API',
      company: 'React Google Maps API',
      kind: 'oss',
      url: 'https://github.com/JustFly1984/react-google-maps-api/pull/3266',
      description:
        'Fixed an infinite React re-render loop in the Directions API example. The loop cost the docs site 61K+ unwanted Google Maps API calls. Stable-callback fix, merged by the maintainer.',
      stats: [
        { label: 'LIBRARY', value: '~1.8M WEEKLY NPM DOWNLOADS' },
        { label: 'ROOT CAUSE', value: 'NEW CALLBACK IDENTITY EVERY RENDER' },
        { label: 'STATUS', value: 'MERGED' },
      ],
    },
    {
      name: 'ERIKUNHA.DEV',
      company: 'Erikunha',
      kind: 'oss',
      url: 'https://github.com/erikunha/portfolio',
      description:
        'This portfolio. Next.js 16 App Router, React 19, RSC-first, a streaming Anthropic endpoint on the Vercel AI SDK, and a CI eval harness that decides if it ships.',
      stats: [
        { label: 'LCP BUDGET', value: '< 1.8s' },
        { label: 'INP BUDGET', value: '< 200ms' },
        { label: 'DECISION LOG', value: '130+ RECORDS' },
      ],
    },
    {
      name: 'LAIBEMAGE',
      company: 'Erikunha',
      kind: 'oss',
      url: 'https://github.com/erikunha/LAIbemage',
      description:
        'Open-source TypeScript CLI (MIT) classifying images across seven LLM vision providers: self-elicited confidence, local-to-cloud escalation below 0.70, two-provider consensus, active-learning queue.',
      stats: [
        { label: 'PROVIDERS', value: '7' },
        { label: 'CI', value: '8 WORKFLOWS' },
        { label: 'GATE', value: '5% REGRESSION' },
      ],
    },
  ]);
