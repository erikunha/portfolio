import { z } from 'zod';
import { type Project, ProjectSchema } from './schemas';

export const projects: Project[] = z.array(ProjectSchema).parse([
  {
    name: 'ORIGINATION_PLATFORM_UI',
    company: 'Raylu',
    mobileName: 'origination_ui/',
    description:
      'Shared UI systems and state architecture for Raylu’s AI deal-origination product, built from zero, co-developed with a second engineer, behind the market maps, target lists, and diligence surfaces private-markets funds work in.',
    mobileDescription:
      'Shared UI systems and state architecture at Raylu, built from zero, co-developed with a second engineer. Market maps, target lists, diligence surfaces. Versioned ViewState, URL-backed state. React, Next.js 14, TypeScript 5.',
    stats: [
      { label: 'SURFACES', value: 'MAPS / LISTS / DILIGENCE' },
      { label: 'STATE', value: 'VERSIONED + URL-BACKED' },
      { label: 'STACK', value: 'React / Next.js 14 / TypeScript 5' },
    ],
    mobileMeta: [
      { label: 'stack', value: 'React · Next.js 14 · TypeScript 5' },
      { label: 'scale', value: '50+ funds · $500B+ AUM' },
      { label: 'status', value: 'production' },
    ],
  },
  {
    name: 'PAYMENT_ORCHESTRA',
    company: 'Betsson Group',
    mobileName: 'payment_orchestra/',
    description:
      'PCI-DSS cashier platform: multi-brand deposit/withdraw orchestration across 15+ regulated markets.',
    mobileDescription:
      'PCI-DSS cashier that handled 40M+ transactions/yr at Betsson. Multi-currency settlement, regulator-grade audit trail, micro-frontends across Angular / React / Ember via Stencil.',
    stats: [
      { label: 'VOLUME', value: '40M+ TX / YR' },
      { label: 'REVENUE', value: '€1B+ / YR' },
      { label: 'STACK', value: 'ANGULAR / REACT / STENCIL / NGRX' },
    ],
    mobileMeta: [
      { label: 'stack', value: 'stencil · angular · rxjs' },
      { label: 'scale', value: '€1B+ ARR' },
      { label: 'status', value: 'production' },
    ],
  },
  {
    name: 'SERVICE_OPS_CONSOLE',
    company: 'Canon Medical Systems',
    mobileName: 'service_ops/',
    description:
      'Hospital equipment service platform: service orders, specialist schedules, field visits; Angular 17 to 19, real-time updates and Clean Architecture.',
    mobileDescription:
      'Hospital equipment service platform for Canon Medical: service orders, specialist schedules, field visits. Angular + Nx + Clean Architecture. -33% JS, -52% TTI, Lighthouse accessibility near 100. OnPush in 52 of 54 components.',
    stats: [
      { label: 'JS BUNDLE', value: '-33%' },
      { label: 'TTI', value: '-52%' },
      { label: 'STACK', value: 'ANGULAR / NX / RXJS' },
    ],
    mobileMeta: [
      { label: 'stack', value: 'angular · nx · clean arch' },
      { label: 'scale', value: 'hospital equipment service' },
      { label: 'status', value: 'production' },
    ],
  },
  {
    name: 'COMMERCE_EDGE',
    company: 'Grupo SBF (Nike / Centauro)',
    mobileName: 'commerce_edge/',
    description:
      'Nike Brazil & Centauro storefronts: SSR/SSG, micro-frontends, experiment-driven UX.',
    mobileDescription:
      'Nike Brazil & Centauro storefronts for Grupo SBF. 8M+ MAU. -32% page load, +10% conversion across 20+ A/B experiments. WebAR try-on, CWV-first image pipeline.',
    stats: [
      { label: 'REACH', value: '8M+ MAU' },
      { label: 'LOAD TIME', value: '-32%' },
      { label: 'STACK', value: 'NEXT.JS / REACT / TS' },
    ],
    mobileMeta: [
      { label: 'stack', value: 'next · react · webar' },
      { label: 'scale', value: '8M+ MAU' },
      { label: 'status', value: 'shipped' },
    ],
  },
  {
    name: 'AI_AGENT_MESH',
    company: 'Betsson Group',
    mobileName: 'ai_agent_mesh/',
    description:
      'GitHub Copilot 12-subagent system: codegen, review, debugging, arch validation. Path-scoped instructions + prompt workflows, shipped team-wide at Betsson.',
    mobileDescription:
      "Copilot 12-subagent system at Betsson: code review, doc-gen, spec-to-PR. -40% onboarding via 35-page arch knowledge system. Built the agents and shipped them team-wide. Also uses Claude API for personal tooling (this portfolio's shell).",
    stats: [
      { label: 'SUBAGENTS', value: '12 + ORCHESTRATOR' },
      { label: 'SCOPE', value: 'TEAM-WIDE' },
      { label: 'STACK', value: 'COPILOT · PATH-SCOPED' },
    ],
    mobileMeta: [
      { label: 'stack', value: 'copilot · subagents · claude' },
      { label: 'scale', value: '12 agents · 4 teams' },
      { label: 'status', value: 'internal' },
    ],
    perm: '-rwx------',
  },
  {
    name: 'EDTECH_OMNI',
    company: 'MB Labs',
    mobileName: 'edtech_omni/',
    description:
      'Cross-platform EdTech app: one codebase, five OSes (Android / iOS / Win / macOS / Linux).',
    mobileDescription:
      'Cross-platform EdTech. One codebase, five OSes. Ionic + Angular + Electron.',
    stats: [
      { label: 'REUSE', value: '~80% CODE' },
      { label: 'COST', value: '-80% VS NATIVE' },
      { label: 'STACK', value: 'IONIC / ANGULAR / ELECTRON' },
    ],
    mobileMeta: [
      { label: 'stack', value: 'ionic · angular · electron' },
      { label: 'scale', value: '5 OSes · production' },
      { label: 'status', value: 'shipped' },
    ],
  },
]);
