import { localeOfPath, type SiteLocale } from '@/content/site-locale';
import type { VitalName } from '@/lib/vitals/metrics';
import { OTHER, type VitalsPayloadBody } from '@/lib/vitals/schema';

export const DEVICE = { mobile: 'mobile', desktop: 'desktop' } as const;
export type Device = (typeof DEVICE)[keyof typeof DEVICE];

export const ROUTE_HOME = 'home';
const ROUTE_SEGMENTS: ReadonlySet<string> = new Set(['summary', 'cv', 'links', 'design-system']);
const LOCALE_PREFIX_PATTERN = /^\/pt(?=\/|$)/;
const MOBILE_MAX_VIEWPORT_WIDTH = 767;
const UNKNOWN_RELEASE = 'unknown';
const ELEMENT_SEPARATOR = '@';
const FIRST_SEGMENT_PATTERN = /^\/([^/]*)/;

export interface VitalRecord {
  name: VitalName;
  value: number;
  route: string;
  locale: SiteLocale;
  device: Device;
  release: string;
  nav?: string;
  el?: string;
  input?: string;
  loadState?: string;
  parts?: Record<string, number>;
}

export function routeKey(pathname: string): string {
  const path = pathname.replace(LOCALE_PREFIX_PATTERN, '') || '/';
  const segment = FIRST_SEGMENT_PATTERN.exec(path)?.[1] ?? '';
  if (segment === '') return ROUTE_HOME;
  return ROUTE_SEGMENTS.has(segment) ? segment : OTHER;
}

function elementKey(tag: string | undefined, landmark: string | undefined): string | undefined {
  if (tag === undefined) return undefined;
  return landmark === undefined ? tag : `${tag}${ELEMENT_SEPARATOR}${landmark}`;
}

function partsOf(metric: VitalsPayloadBody['metrics'][number]): Record<string, number> | undefined {
  if (metric.name === 'LCP') {
    const { ttfb, loadDelay, loadDuration, renderDelay } = metric;
    return { ttfb, loadDelay, loadDuration, renderDelay };
  }
  if (metric.name === 'INP') {
    const { inputDelay, processing, presentation } = metric;
    return { inputDelay, processing, presentation };
  }
  return undefined;
}

export function toVitalRecords(payload: VitalsPayloadBody): VitalRecord[] {
  const route = routeKey(payload.path);
  const locale = localeOfPath(payload.path);
  const device = payload.vw <= MOBILE_MAX_VIEWPORT_WIDTH ? DEVICE.mobile : DEVICE.desktop;
  const release = payload.release ?? UNKNOWN_RELEASE;
  return payload.metrics.map((metric) => {
    const el = elementKey(metric.tag, metric.landmark);
    const parts = partsOf(metric);
    return {
      name: metric.name,
      value: metric.value,
      route,
      locale,
      device,
      release,
      ...(metric.nav === undefined ? {} : { nav: metric.nav }),
      ...(el === undefined ? {} : { el }),
      ...(metric.name === 'INP' && metric.input !== undefined ? { input: metric.input } : {}),
      ...(metric.loadState === undefined ? {} : { loadState: metric.loadState }),
      ...(parts === undefined ? {} : { parts }),
    };
  });
}
