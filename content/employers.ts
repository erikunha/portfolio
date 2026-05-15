// content/employers.ts
// Career history — displayed in GitLogSection as a git blame / commit log.
import { z } from 'zod';
import { type BlameEntry, BlameEntrySchema } from './schemas';

export const employers: BlameEntry[] = z.array(BlameEntrySchema).parse([
  {
    dates: '2024 → present',
    company: 'BETSSON GROUP',
    role: 'Senior Frontend Engineer',
    reason:
      'PCI-DSS cashier · 40M+ tx/yr · €1B+ ARR · micro-frontends with Stencil across Angular/React/Ember · built a 12-agent AI tooling mesh · -40% onboarding via 35-page arch system.',
  },
  {
    dates: '2023 → 2024',
    company: 'CANON MEDICAL',
    role: 'Senior Angular Engineer',
    reason:
      "Angular + Nx + Clean Architecture. -33% JS, -98% CSS, +52% TTI, ~100% WCAG 2.1 AA. Cheapest culture audit I've ever run.",
  },
  {
    dates: '2021 → 2023',
    company: 'GRUPO SBF',
    role: 'Frontend Engineer · Nike BR / Centauro',
    reason: '8M+ MAU storefronts. -32% page load. +10% conversion across 20+ A/B experiments. WebAR try-on.',
  },
  {
    dates: '2020 → 2021',
    company: 'ENCORA · ZUP / ITAÚ BANK',
    role: 'Software Engineer',
    reason: "Brazil's largest private bank. Internal tools, design system contributions, regulated banking UX.",
  },
  {
    dates: '2019 → 2020',
    company: 'VENTURUS',
    role: 'Full-stack Engineer',
    reason: 'Reporting endpoint: 40s → <1s. -97.5% latency via query redesign + indexing. Headliner.',
  },
  {
    dates: '2017 → 2019',
    company: 'MB LABS',
    role: 'Software Engineer',
    reason: 'Shipped EdTech as Electron desktop across 5 OSes. -40% build time via consolidation.',
  },
]);
