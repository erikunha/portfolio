import { z } from 'zod';
import { type Project, ProjectSchema } from './schemas';

export const projects: Project[] = z.array(ProjectSchema).parse([
  {
    name: 'PAYMENT_ORCHESTRA',
    mobileName: 'payment_orchestra/',
    description:
      'PCI-DSS cashier platform — multi-brand deposit/withdraw orchestration across 15+ regulated markets.',
    mobileDescription:
      'PCI-DSS cashier handling 40M+ transactions/yr at Betsson. Multi-currency settlement, regulator-grade audit trail, micro-frontends across Angular / React / Ember via Stencil.',
    stats: [
      { label: 'VOLUME', value: '40M+ TX / YR' },
      { label: 'REVENUE', value: '€1B+ / YR' },
      { label: 'STACK', value: 'ANGULAR / STENCIL / NGRX' },
    ],
    mobileMeta: [
      { label: 'stack', value: 'stencil · angular · rxjs' },
      { label: 'scale', value: '€1B+ ARR' },
      { label: 'status', value: 'production' },
    ],
  },
  {
    name: 'CARE_OPS_CONSOLE',
    mobileName: 'care_ops/',
    description:
      'Mission-critical hospital operations dashboards — real-time, multi-site, Clean Architecture.',
    mobileDescription:
      'Angular + Nx + Clean Architecture frontend for Canon Medical workflow ops. -33% JS, +52% TTI, ~100% WCAG 2.1 AA. Lazy-loaded modules, OnPush everywhere, concurrent async pipelines.',
    stats: [
      { label: 'JS BUNDLE', value: '-33%' },
      { label: 'TTI GAIN', value: '+52%' },
      { label: 'STACK', value: 'ANGULAR / NX / RXJS' },
    ],
    mobileMeta: [
      { label: 'stack', value: 'angular · nx · clean arch' },
      { label: 'scale', value: 'hospital ops' },
      { label: 'status', value: 'production' },
    ],
  },
  {
    name: 'COMMERCE_EDGE',
    mobileName: 'commerce_edge/',
    description:
      'Nike Brazil & Centauro storefronts — SSR/SSG, micro-frontends, experiment-driven UX.',
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
    mobileName: 'ai_agent_mesh/',
    description:
      'GitHub Copilot 12-subagent system — codegen, review, debugging, arch validation. Path-scoped instructions + prompt workflows, shipped team-wide at Betsson.',
    mobileDescription:
      "Copilot 12-subagent system at Betsson — code review, doc-gen, spec-to-PR. -40% onboarding via 35-page arch knowledge system. Built and maintains the agents. Also uses Claude API for personal tooling (this portfolio's shell).",
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
    mobileName: 'edtech_omni/',
    description:
      'Cross-platform EdTech app — one codebase, five OSes (Android / iOS / Win / macOS / Linux).',
    mobileDescription: 'Cross-platform EdTech. One codebase, five OSes. Ionic + Angular + Electron.',
    stats: [
      { label: 'REUSE', value: '~90% LOGIC' },
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
