import { z } from 'zod';
import { type PerfReceipt, PerfReceiptSchema, StatSchema } from './schemas';

type Stat = z.infer<typeof StatSchema>;

export const perfReceipts: PerfReceipt[] = z.array(PerfReceiptSchema).parse([
  {
    metric: 'API_LATENCY',
    delta: '-97.5%',
    company: '@ VENTURUS',
    note: 'reporting API at a client platform. Query rewrite + PostgreSQL indexes.',
    project: true,
    displayValue: '40s→<1s',
    before: 40,
    after: 1,
    unit: 's',
  },
  {
    metric: 'BUNDLE_CSS',
    delta: '-98%',
    company: '@ CANON_MEDICAL',
    note: 'PrimeFlex utility refactor on the layout shell, plus lazy load',
    project: true,
  },
  {
    metric: 'TTI',
    delta: '-52%',
    company: '@ CANON_MEDICAL',
    note: 'concurrent async + OnPush.',
  },
  {
    metric: 'INITIAL_LOAD',
    delta: '-25%',
    company: '@ CANON_MEDICAL',
    note: 'Lazy-loaded modules and route-level code splitting',
    project: true,
  },
  {
    metric: 'BUNDLE_JS',
    delta: '-33%',
    company: '@ CANON_MEDICAL',
    note: 'code splitting + dynamic imports.',
  },
  {
    metric: 'PAGE_LOAD',
    delta: '-32%',
    company: '@ GRUPO_SBF',
    note: 'CWV optimization + image pipeline.',
  },
  {
    metric: 'CONVERSION',
    delta: '+10%',
    company: '@ GRUPO_SBF',
    note: '20+ A/B experiments.',
    project: true,
  },
  {
    metric: 'DESKTOP_BUILD',
    delta: '-40%',
    company: '@ MB_LABS',
    note: 'one Ionic + Angular + Electron codebase, ~80% shared across 5 OSes.',
    project: true,
  },
  {
    metric: 'ONBOARDING_TIME',
    delta: '-40%',
    company: '@ BETSSON_GROUP',
    note: '35-page architecture knowledge system + diagrams.',
    mobileMetric: 'ONBOARDING',
  },
  {
    metric: 'LCP',
    delta: '-48.6%',
    company: '@ RAYLU',
    note: 'one route, data-platform migration behind a production A/B.',
    project: true,
    displayValue: '2,544→1,308ms',
    before: 2544,
    after: 1308,
    unit: 'ms',
  },
]);

export const projectReceipts = perfReceipts.filter((receipt) => receipt.project);

export const receiptsHeading = z.string().min(1).parse('PERF_RECEIPTS --HARD-NUMBERS');

export const heroStats: Stat[] = z
  .array(StatSchema)
  .length(4)
  .parse([
    { value: '€1B+ ARR', label: 'cashier platform' },
    { value: '8M+ MAU', label: 'e-commerce' },
    { value: '-97.5% latency', label: 'API performance' },
    { value: '12-agent AI', label: 'platform' },
  ]);
