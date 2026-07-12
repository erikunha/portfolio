import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { perfReceipts } from '@/content/perf-receipts';
import { projects } from '@/content/projects';
import { PerfReceiptSchema } from '@/content/schemas';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';
import { HIRING_PROFILE } from '@/lib/hiring-profile';

const REPO_ROOT = path.resolve(__dirname, '..');
const read = (relativePath: string) => readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');

const receiptFor = (metric: string) => {
  const receipt = perfReceipts.find((r) => r.metric === metric);
  if (!receipt) throw new Error(`no perf receipt for ${metric}`);
  return receipt.delta;
};

const flipSign = (delta: string) =>
  delta.startsWith('-') ? `+${delta.slice(1)}` : `-${delta.slice(1)}`;

const METRIC_KEYWORDS: Record<string, RegExp> = {
  API_LATENCY: /latency/i,
  BUNDLE_CSS: /css/i,
  TTI: /\bTTI\b|time.to.interactive/i,
  BUNDLE_JS: /\bJS\b|javascript/i,
  PAGE_LOAD: /page[\s-]*load|load[\s-]*time/i,
  INITIAL_LOAD: /initial[\s-]*(page[\s-]*)?load/i,
  CONVERSION: /conversion/i,
  DESKTOP_BUILD: /desktop[\s-]*build|build[\s-]*time/i,
  ONBOARDING_TIME: /onboarding/i,
};

const PROXIMITY_CHARS = 60;

const nearKeyword = (text: string, needle: string, keyword: RegExp) => {
  let from = 0;
  for (;;) {
    const at = text.indexOf(needle, from);
    if (at === -1) return false;
    const window = text.slice(
      Math.max(0, at - PROXIMITY_CHARS),
      at + needle.length + PROXIMITY_CHARS,
    );
    if (keyword.test(window)) return true;
    from = at + needle.length;
  }
};

const METRIC_SURFACES: Array<[string, string]> = [
  ['content/perf-receipts.ts (heroStats)', read('content/perf-receipts.ts')],
  ['content/projects.ts', read('content/projects.ts')],
  ['content/seo.ts', read('content/seo.ts')],
  ['content/git-log.ts', read('content/git-log.ts')],
  ['content/sys-health.ts', read('content/sys-health.ts')],
  ['content/hottest-takes.ts', read('content/hottest-takes.ts')],
  ['content/man-page.ts', read('content/man-page.ts')],
  ['content/ask-eval-corpus.ts', read('content/ask-eval-corpus.ts')],
  ['content/ask-eval-calibration.ts', read('content/ask-eval-calibration.ts')],
  ['lib/hiring-profile.ts (served at /api/erik.json)', JSON.stringify(HIRING_PROFILE)],
  ['lib/ask/system-prompt.ts (what the AI answers with)', SYSTEM_TEXT],
  ['public/llms.txt', read('public/llms.txt')],
];

const HIRING_PROFILE_RECEIPT_FIELDS: Array<[string, string]> = [
  ['tti_improvement', 'TTI'],
  ['page_load_reduction', 'PAGE_LOAD'],
  ['conversion_uplift', 'CONVERSION'],
  ['api_latency_reduction', 'API_LATENCY'],
  ['onboarding_reduction', 'ONBOARDING_TIME'],
  ['perf_delta_js', 'BUNDLE_JS'],
  ['perf_delta_css', 'BUNDLE_CSS'],
];

const PROJECT_STAT_METRICS: Record<string, string> = {
  TTI: 'TTI',
  'JS BUNDLE': 'BUNDLE_JS',
  'LOAD TIME': 'PAGE_LOAD',
};

describe('performance metrics agree with the authoritative receipts', () => {
  it('the schema forbids an unsigned delta, so the sign sweep cannot degrade to a no-op', () => {
    const unsigned = PerfReceiptSchema.safeParse({
      metric: 'BUNDLE_JS',
      delta: '10%',
      company: '@ ACME',
      note: 'no leading sign.',
    });

    expect(
      unsigned.success,
      'PerfReceiptSchema must reject a delta with no leading + or -. flipSign() turns "10%" into "-0%" — a string no surface contains — so the opposite-sign sweep for that metric silently passes forever instead of failing: the exact fail-open class this file exists to close. Fix the schema, not this test.',
    ).toBe(false);
  });

  it('every receipt has a keyword, so no metric can be added and left unswept', () => {
    const unmapped = perfReceipts
      .map((receipt) => receipt.metric)
      .filter((metric) => METRIC_KEYWORDS[metric] === undefined);

    expect(
      unmapped,
      'a new receipt was added without a keyword in METRIC_KEYWORDS, so the sign sweep silently skips it. Coverage must be the default: add the keyword, do not delete this assertion.',
    ).toEqual([]);
  });

  it('no surface states the OPPOSITE sign of a receipt', () => {
    const contradictions = METRIC_SURFACES.flatMap(([surface, text]) =>
      perfReceipts
        .filter((receipt) => {
          const keyword = METRIC_KEYWORDS[receipt.metric];
          return keyword !== undefined && nearKeyword(text, flipSign(receipt.delta), keyword);
        })
        .map(
          (receipt) =>
            `${surface}: ${receipt.metric} is ${receipt.delta}, but found ${flipSign(receipt.delta)} next to it`,
        ),
    );

    expect(
      contradictions,
      `a surface states the opposite sign of an authoritative receipt (content/perf-receipts.ts). Not hypothetical: TTI shipped as -52% in perf-receipts.ts and seo.ts while projects.ts, hiring-profile.ts, the /api/ask system prompt AND the eval corpus all said +52% — so the AI answered the opposite sign from the JSON-LD on the same metric, and the eval graded it against the wrong one.

SCOPE: opposite SIGN only. Magnitude drift in prose is NOT caught (-25% to -2.5% passes here); magnitude is held only where an explicit field mapping exists — HIRING_PROFILE_RECEIPT_FIELDS and PROJECT_STAT_METRICS below. DECISIONS.md (2026-07-12) records why prose magnitude is deliberately ungated.

IF THIS FIRED ON A TRUE SENTENCE: it fires when the flipped number sits within ${PROXIMITY_CHARS} chars of the metric's keyword, so a TRUE claim about a DIFFERENT metric that shares a magnitude in the same breath trips it — "bounce rate -10%" beside CONVERSION (+10%). Proximity cannot disambiguate two metrics sharing a number inside one sentence. Do NOT delete the true claim, and do NOT widen a keyword: METRIC_KEYWORDS is already tuned against two live collisions — "load time" is PAGE_LOAD's own rendered tile label (handing it to INITIAL_LOAD reds the real LOAD TIME tile), and a bare /build/i matches "building the frontend platform" in llms.txt and the system prompt. Narrow the sentence, or give the other metric its own receipt so it gets a keyword of its own.`,
    ).toEqual([]);
  });

  it('lib/hiring-profile.ts (served at /api/erik.json) matches the receipts', () => {
    const drifted = HIRING_PROFILE_RECEIPT_FIELDS.filter(([field, metric]) => {
      const served = HIRING_PROFILE.receipts[field];
      return served === undefined || !served.startsWith(receiptFor(metric));
    }).map(
      ([field, metric]) =>
        `receipts.${field} = ${JSON.stringify(HIRING_PROFILE.receipts[field])} but ${metric} is ${receiptFor(metric)}`,
    );

    expect(
      drifted,
      'the machine-readable hiring profile must quote the same numbers as the receipts. It is the endpoint llms.txt advertises to crawlers, so a wrong number here is consumed by machines and never eyeballed. This reads the PARSED object, not the source literal: HiringProfileSchema strips unknown keys, so `undefined` means the field is not being SERVED AT ALL — a different bug from serving it wrong, and one that renaming a field out of `receipts` causes silently.',
    ).toEqual([]);
  });

  it('content/projects.ts stat tiles match the receipts', () => {
    const drifted = projects.flatMap((project) =>
      project.stats
        .filter((stat) => {
          const metric = PROJECT_STAT_METRICS[stat.label];
          return metric !== undefined && stat.value !== receiptFor(metric);
        })
        .map(
          (stat) =>
            `${project.name}: "${stat.label}" = ${stat.value} but ${PROJECT_STAT_METRICS[stat.label]} is ${receiptFor(PROJECT_STAT_METRICS[stat.label] as string)}`,
        ),
    );

    expect(
      drifted,
      'a rendered stat tile disagrees with the receipt it quotes. The tile is what a visitor reads; the receipt is what the AI cites. They must be the same number. Unlike the prose sweep, this compares the value exactly — it catches magnitude drift, not just a flipped sign.',
    ).toEqual([]);
  });
});
