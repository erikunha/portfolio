import { type SysStat, SysStatSchema } from './schemas';

export const sysStats: SysStat[] = SysStatSchema.array().parse([
  { label: 'EXPERIENCE', value: '8+ YRS', pct: '85%' },
  { label: 'TX VOL / YR', value: '40M+', pct: '95%' },
  { label: 'A11Y SCORE', value: '~100 / 100', pct: '100%' },
  { label: 'PERF DELTA', value: '-33% JS / -98% CSS', pct: '90%' },
]);
