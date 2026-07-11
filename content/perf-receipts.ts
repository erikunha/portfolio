import { z } from 'zod';
import { type PerfReceipt, PerfReceiptSchema, StatSchema } from './schemas';

type Stat = z.infer<typeof StatSchema>;

export const perfReceipts: PerfReceipt[] = z.array(PerfReceiptSchema).parse([
  {
    metric: 'API_LATENCY',
    delta: '-97.5%',
    company: '@ VENTURUS',
    note: '40s → <1s on a reporting endpoint. Query redesign + indexing strategy.',
  },
  {
    metric: 'BUNDLE_CSS',
    delta: '-98%',
    company: '@ CANON_MEDICAL',
    note: 'layout refactor + lazy load.',
  },
  {
    metric: 'TTI',
    delta: '-52%',
    company: '@ CANON_MEDICAL',
    note: 'concurrent async + OnPush.',
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
  },
  {
    metric: 'DESKTOP_BUILD',
    delta: '-40%',
    company: '@ MB_LABS',
    note: 'Electron consolidation across 5 OS.',
    desktopOnly: true,
  },
  {
    metric: 'ONBOARDING_TIME',
    delta: '-40%',
    company: '@ BETSSON_GROUP',
    note: '35-page architecture knowledge system + diagrams.',
    mobileMetric: 'ONBOARDING',
  },
]);

export const heroStats: Stat[] = z
  .array(StatSchema)
  .length(4)
  .parse([
    { value: '€1B+ ARR', label: 'cashier platform' },
    { value: '8M+ MAU', label: 'e-commerce' },
    { value: '-97.5% latency', label: 'API performance' },
    { value: '12-agent AI', label: 'platform' },
  ]);
