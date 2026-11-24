import { z } from 'zod';

import { MAIN_CONTENT_ID } from '@/content/landmarks';
import { SECTION_REGISTRY } from '@/content/section-registry';
import { INTERACTION_TYPES, LOAD_STATES, NAVIGATION_TYPES, VITAL_NAME } from '@/lib/vitals/metrics';

export const OTHER = 'other';
export const VITALS_MAX_BODY_BYTES = 2048;

const MAX_PATH_CHARS = 256;
const MAX_RELEASE_CHARS = 40;
const MAX_TAG_CHARS = 16;
const MAX_ID_CHARS = 40;
const MAX_VIEWPORT_WIDTH = 100_000;
const MAX_TIME_MS = 120_000;
const MAX_CLS_VALUE = 100;
const RELEASE_PATTERN = /^[A-Za-z0-9._-]+$/;

const KNOWN_TAGS: ReadonlySet<string> = new Set([
  'a',
  'article',
  'aside',
  'body',
  'button',
  'canvas',
  'code',
  'details',
  'div',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'html',
  'img',
  'input',
  'label',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'picture',
  'pre',
  'section',
  'select',
  'small',
  'span',
  'strong',
  'summary',
  'svg',
  'table',
  'textarea',
  'time',
  'ul',
  'video',
]);

const KNOWN_LANDMARKS: ReadonlySet<string> = new Set([
  MAIN_CONTENT_ID,
  ...SECTION_REGISTRY.map(({ id }) => id),
]);

const boundedTime = z.number().finite().min(0).max(MAX_TIME_MS);
const enumOrUndefined = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().catch(undefined);

const Element = {
  tag: z
    .string()
    .max(MAX_TAG_CHARS)
    .transform((tag) => (KNOWN_TAGS.has(tag) ? tag : OTHER))
    .optional(),
  landmark: z
    .string()
    .max(MAX_ID_CHARS)
    .transform((id) => (KNOWN_LANDMARKS.has(id) ? id : OTHER))
    .optional(),
  nav: enumOrUndefined(NAVIGATION_TYPES),
  loadState: enumOrUndefined(LOAD_STATES),
};

const LcpMetric = z.object({
  name: z.literal(VITAL_NAME.lcp),
  value: boundedTime,
  ttfb: boundedTime,
  loadDelay: boundedTime,
  loadDuration: boundedTime,
  renderDelay: boundedTime,
  ...Element,
});

const InpMetric = z.object({
  name: z.literal(VITAL_NAME.inp),
  value: boundedTime,
  input: enumOrUndefined(INTERACTION_TYPES),
  inputDelay: boundedTime,
  processing: boundedTime,
  presentation: boundedTime,
  ...Element,
});

const ClsMetric = z.object({
  name: z.literal(VITAL_NAME.cls),
  value: z.number().finite().min(0).max(MAX_CLS_VALUE),
  ...Element,
});

const VitalMetric = z.discriminatedUnion('name', [LcpMetric, InpMetric, ClsMetric]);

export const VitalsPayload = z.object({
  path: z.string().min(1).max(MAX_PATH_CHARS),
  vw: z.number().int().min(0).max(MAX_VIEWPORT_WIDTH),
  release: z.string().max(MAX_RELEASE_CHARS).regex(RELEASE_PATTERN).optional().catch(undefined),
  metrics: z
    .array(VitalMetric)
    .min(1)
    .max(Object.keys(VITAL_NAME).length)
    .refine((metrics) => new Set(metrics.map(({ name }) => name)).size === metrics.length),
});

export type VitalsPayloadBody = z.infer<typeof VitalsPayload>;
