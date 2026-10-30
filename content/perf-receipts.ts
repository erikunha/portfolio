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
    note: 'Next.js code splitting, dynamic imports, image optimization and caching.',
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
    metric: 'CLS',
    delta: '-100%',
    company: '@ RAYLU',
    note: 'layout shift 0.166 to 0 on the company route.',
    displayValue: '0.166→0',
    before: 0.166,
    after: 0,
  },
  {
    metric: 'LIGHTHOUSE',
    delta: '+21.5%',
    company: '@ RAYLU',
    note: 'performance score 79 to 96 on the company route.',
    displayValue: '79→96',
    before: 79,
    after: 96,
  },
  {
    metric: 'RELEASE_TIME',
    delta: '-85%',
    company: '@ CANON_MEDICAL',
    note: 'release pipeline about 5 min to about 45 s.',
    displayValue: '~5min→~45s',
    before: 300,
    after: 45,
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
