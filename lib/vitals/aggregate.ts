import { rateVital, VITAL_RATING, type VitalName, type VitalRating } from '@/lib/vitals/metrics';
import type { VitalRecord } from '@/lib/vitals/records';

const P75 = 0.75;
const TOP_ELEMENTS = 5;
const GROUP_SEPARATOR = '|';

export interface VitalGroup {
  name: VitalName;
  route: string;
  device: string;
  release: string;
  count: number;
  p75: number;
  share: Record<VitalRating, number>;
  slowParts: Record<string, number>;
  slowCount: number;
  topElements: { el: string; count: number }[];
}

export function percentile(sortedAscending: readonly number[], fraction: number): number {
  if (sortedAscending.length === 0) return 0;
  const rank = Math.ceil(fraction * sortedAscending.length) - 1;
  return sortedAscending[Math.min(Math.max(rank, 0), sortedAscending.length - 1)] ?? 0;
}

function groupKey(record: VitalRecord): string {
  return [record.name, record.route, record.device, record.release].join(GROUP_SEPARATOR);
}

function parseRecord(raw: unknown): VitalRecord | undefined {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (value && typeof value === 'object' && 'name' in value && 'value' in value) {
      return value as VitalRecord;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function summarizeGroup(records: readonly VitalRecord[]): VitalGroup {
  const [first] = records as [VitalRecord, ...VitalRecord[]];
  const values = records.map(({ value }) => value).sort((a, b) => a - b);
  const share: Record<VitalRating, number> = {
    [VITAL_RATING.good]: 0,
    [VITAL_RATING.needsImprovement]: 0,
    [VITAL_RATING.poor]: 0,
  };
  const partSums: Record<string, number> = {};
  const elements = new Map<string, number>();
  let slowCount = 0;
  for (const record of records) {
    const rating = rateVital(record.name, record.value);
    share[rating] += 1;
    if (rating === VITAL_RATING.good) continue;
    slowCount += 1;
    for (const [part, ms] of Object.entries(record.parts ?? {})) {
      partSums[part] = (partSums[part] ?? 0) + ms;
    }
    if (record.el) elements.set(record.el, (elements.get(record.el) ?? 0) + 1);
  }
  return {
    name: first.name,
    route: first.route,
    device: first.device,
    release: first.release,
    count: records.length,
    p75: percentile(values, P75),
    share: {
      [VITAL_RATING.good]: share[VITAL_RATING.good] / records.length,
      [VITAL_RATING.needsImprovement]: share[VITAL_RATING.needsImprovement] / records.length,
      [VITAL_RATING.poor]: share[VITAL_RATING.poor] / records.length,
    },
    slowCount,
    slowParts: Object.fromEntries(
      Object.entries(partSums).map(([part, sum]) => [part, Math.round(sum / slowCount)]),
    ),
    topElements: [...elements.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_ELEMENTS)
      .map(([el, count]) => ({ el, count })),
  };
}

export function summarizeVitals(rawRecords: readonly unknown[]): VitalGroup[] {
  const groups = new Map<string, VitalRecord[]>();
  for (const raw of rawRecords) {
    const record = parseRecord(raw);
    if (!record) continue;
    const key = groupKey(record);
    const bucket = groups.get(key);
    if (bucket) bucket.push(record);
    else groups.set(key, [record]);
  }
  return [...groups.values()]
    .map(summarizeGroup)
    .sort((a, b) => a.name.localeCompare(b.name) || b.count - a.count);
}

export function formatVitals(groups: readonly VitalGroup[]): string {
  if (groups.length === 0) return 'no records';
  const percent = (fraction: number): string => `${Math.round(fraction * 100)}%`;
  return groups
    .map((group) => {
      const unit = group.name === 'CLS' ? '' : 'ms';
      const head = `${group.name} ${group.route} ${group.device} ${group.release} n=${group.count} p75=${group.p75}${unit} good ${percent(group.share.good)} ni ${percent(group.share['needs-improvement'])} poor ${percent(group.share.poor)}`;
      const parts = Object.entries(group.slowParts)
        .map(([part, ms]) => `${part}=${ms}ms`)
        .join(' ');
      const slow = parts ? `\n  slow mean (${group.slowCount}): ${parts}` : '';
      const elements = group.topElements.length
        ? `\n  slow elements: ${group.topElements.map(({ el, count }) => `${el} x${count}`).join(', ')}`
        : '';
      return `${head}${slow}${elements}`;
    })
    .join('\n');
}
