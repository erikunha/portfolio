import { describe, expect, it } from 'vitest';
import type { MetricWithAttribution } from 'web-vitals/attribution';
import { toWireMetric } from '@/lib/vitals/wire';

const base = { rating: 'good', delta: 0, id: 'v1', entries: [], navigationId: 0 } as const;

describe('toWireMetric', () => {
  it('maps LCP to its four subparts and an element label, rounded to milliseconds', () => {
    const metric = {
      ...base,
      name: 'LCP',
      value: 2345.6,
      navigationType: 'navigate',
      entries: [],
      attribution: {
        target: 'section#bio>div>h1',
        url: 'https://example.test/secret.png',
        timeToFirstByte: 120.4,
        resourceLoadDelay: 30.5,
        resourceLoadDuration: 0,
        elementRenderDelay: 2194.7,
      },
    } as unknown as MetricWithAttribution;

    expect(toWireMetric(metric)).toEqual({
      name: 'LCP',
      value: 2346,
      nav: 'navigate',
      tag: 'h1',
      landmark: 'bio',
      ttfb: 120,
      loadDelay: 31,
      loadDuration: 0,
      renderDelay: 2195,
    });
  });

  it('maps INP to the interaction type, the three phases and the load state', () => {
    const metric = {
      ...base,
      name: 'INP',
      value: 312,
      navigationType: 'reload',
      attribution: {
        interactionTarget: 'section#sec-contact>form>button',
        interactionType: 'keyboard',
        inputDelay: 12.2,
        processingDuration: 250.1,
        presentationDelay: 49.7,
        loadState: 'complete',
        processedEventEntries: [],
        longAnimationFrameEntries: [],
      },
    } as unknown as MetricWithAttribution;

    expect(toWireMetric(metric)).toEqual({
      name: 'INP',
      value: 312,
      nav: 'reload',
      tag: 'button',
      landmark: 'sec-contact',
      input: 'keyboard',
      loadState: 'complete',
      inputDelay: 12,
      processing: 250,
      presentation: 50,
    });
  });

  it('maps CLS to four decimals and the largest shift source, and omits what is absent', () => {
    const metric = {
      ...base,
      name: 'CLS',
      value: 0.123456,
      navigationType: 'navigate',
      attribution: {},
    } as unknown as MetricWithAttribution;

    expect(toWireMetric(metric)).toEqual({ name: 'CLS', value: 0.1235, nav: 'navigate' });
  });

  it('ignores a metric the site does not collect', () => {
    const metric = { ...base, name: 'TTFB', value: 1, navigationType: 'navigate' };

    expect(toWireMetric(metric as unknown as MetricWithAttribution)).toBeUndefined();
  });
});
