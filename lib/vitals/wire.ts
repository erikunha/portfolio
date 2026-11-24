import type { MetricWithAttribution } from 'web-vitals/attribution';
import { type ElementLabel, elementLabel } from '@/lib/vitals/element-label';
import { VITAL_NAME } from '@/lib/vitals/metrics';

const CLS_DECIMALS = 10_000;

interface WireBase extends ElementLabel {
  value: number;
  nav?: string;
  loadState?: string;
}

export interface WireLcp extends WireBase {
  name: typeof VITAL_NAME.lcp;
  ttfb: number;
  loadDelay: number;
  loadDuration: number;
  renderDelay: number;
}

export interface WireInp extends WireBase {
  name: typeof VITAL_NAME.inp;
  input?: string;
  inputDelay: number;
  processing: number;
  presentation: number;
}

export interface WireCls extends WireBase {
  name: typeof VITAL_NAME.cls;
}

export type WireMetric = WireLcp | WireInp | WireCls;

export interface WirePayload {
  path: string;
  vw: number;
  release?: string;
  metrics: WireMetric[];
}

function optional<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  return value === undefined ? {} : ({ [key]: value } as { [P in K]?: V });
}

export function toWireMetric(metric: MetricWithAttribution): WireMetric | undefined {
  const nav = optional('nav', metric.navigationType);
  switch (metric.name) {
    case VITAL_NAME.lcp: {
      const { attribution } = metric;
      return {
        name: VITAL_NAME.lcp,
        value: Math.round(metric.value),
        ...nav,
        ...elementLabel(attribution.target),
        ttfb: Math.round(attribution.timeToFirstByte),
        loadDelay: Math.round(attribution.resourceLoadDelay),
        loadDuration: Math.round(attribution.resourceLoadDuration),
        renderDelay: Math.round(attribution.elementRenderDelay),
      };
    }
    case VITAL_NAME.inp: {
      const { attribution } = metric;
      return {
        name: VITAL_NAME.inp,
        value: Math.round(metric.value),
        ...nav,
        ...elementLabel(attribution.interactionTarget),
        ...optional('input', attribution.interactionType),
        loadState: attribution.loadState,
        inputDelay: Math.round(attribution.inputDelay),
        processing: Math.round(attribution.processingDuration),
        presentation: Math.round(attribution.presentationDelay),
      };
    }
    case VITAL_NAME.cls: {
      const { attribution } = metric;
      return {
        name: VITAL_NAME.cls,
        value: Math.round(metric.value * CLS_DECIMALS) / CLS_DECIMALS,
        ...nav,
        ...elementLabel(attribution.largestShiftTarget),
        ...optional('loadState', attribution.loadState),
      };
    }
    default:
      return undefined;
  }
}
