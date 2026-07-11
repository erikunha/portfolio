import { z } from 'zod';
import { type BlameEntry, BlameEntrySchema } from './schemas';

export const employers: BlameEntry[] = z.array(BlameEntrySchema).parse([
  {
    dates: '2026 → present',
    company: 'RAYLU.AI',
    role: 'Senior Software Engineer',
    reason:
      'Frontend platform for the AI deal-origination engine — market maps, target lists, diligence surfaces for 45+ funds representing $500B+ AUM · shared UI systems + state architecture (versioned ViewState, URL-synced state) · RFC/ADR-driven delivery.',
  },
  {
    dates: '2025 → 2026',
    company: 'BETSSON GROUP',
    role: 'Senior Software Engineer',
    reason:
      'PCI-DSS cashier · 40M+ tx/yr · €1B+ ARR · micro-frontends across Angular/React/Ember via Stencil · 12-subagent Copilot system · -40% onboarding via 35-page arch knowledge system.',
  },
  {
    dates: '2023 → 2025',
    company: 'CANON MEDICAL',
    role: 'Senior Software Engineering Consulting',
    reason:
      "Angular + Nx + Clean Architecture. -33% JS, -98% CSS, +52% TTI, ~100% WCAG 2.1 AA. Cheapest culture audit I've ever run.",
  },
  {
    dates: '2021 → 2023',
    company: 'GRUPO SBF',
    role: 'React Engineer · Nike BR / Centauro',
    reason:
      '8M+ MAU storefronts. -32% page load. +10% conversion across 20+ A/B experiments. WebAR uplift on add-to-cart.',
  },
  {
    dates: '2021 → 2021',
    company: 'ENCORA (VMware Pathfinder)',
    role: 'Frontend Engineer',
    reason:
      '2.1M+ cumulative labs delivered globally. Angular, NgRx, AWS CodePipeline/CloudFront. Zoom API integration.',
  },
  {
    dates: '2020 → 2021',
    company: 'ZUP / ITAÚ BANK',
    role: 'Frontend Engineer',
    reason:
      "Brazil's largest private bank. Angular Web Components, micro-frontend architecture, regulated banking UX.",
  },
  {
    dates: '2019 → 2020',
    company: 'VENTURUS',
    role: 'Frontend / Full-Stack Engineer (MEAN)',
    reason:
      'CCR AutoBAn highway ops dashboards (Angular/RxJS) + foreign trade platform: reporting 40s → <1s, -97.5% latency via query redesign + indexing.',
  },
  {
    dates: '2018 → 2019',
    company: 'MB LABS',
    role: 'Mobile / Full-Stack Developer',
    reason:
      'Shipped EdTech as Electron desktop across 5 OSes. -80% vs native, -40% build time via Ionic + Angular consolidation.',
  },
]);
