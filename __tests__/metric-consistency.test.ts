import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { perfReceipts } from '@/content/perf-receipts';
import { projects } from '@/content/projects';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';
import { HIRING_PROFILE } from '@/lib/hiring-profile';

const REPO_ROOT = path.resolve(__dirname, '..');
const read = (relativePath: string) => readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');

// content/perf-receipts.ts is the authoritative source for every performance number
// (CLAUDE.md: "cite the receipts from the Performance receipts section — they are the
// authoritative source"). Everything below asks the same question of a different surface:
// does it agree with the receipt?
const receiptFor = (metric: string) => {
  const receipt = perfReceipts.find((r) => r.metric === metric);
  if (!receipt) throw new Error(`no perf receipt for ${metric}`);
  return receipt.delta;
};

const flipSign = (delta: string) =>
  delta.startsWith('-') ? `+${delta.slice(1)}` : `-${delta.slice(1)}`;

// Every surface that quotes a performance number in prose or structured data.
const METRIC_SURFACES: Array<[string, string]> = [
  ['content/projects.ts', read('content/projects.ts')],
  ['content/seo.ts', read('content/seo.ts')],
  ['content/ask-eval-corpus.ts', read('content/ask-eval-corpus.ts')],
  ['content/ask-eval-calibration.ts', read('content/ask-eval-calibration.ts')],
  ['content/man-page.ts', read('content/man-page.ts')],
  ['lib/hiring-profile.ts', JSON.stringify(HIRING_PROFILE)],
  ['lib/ask/system-prompt.ts', SYSTEM_TEXT],
  ['public/llms.txt', read('public/llms.txt')],
];

// hiring-profile.receipts field -> the receipt it must agree with. NOT `.metrics`:
// HiringProfileSchema declares `receipts`, and .parse() STRIPS unknown keys — a field under
// any other name would be silently dropped from /api/erik.json rather than served wrong.
// Several carry a trailing gloss ("-97.5% (40s->1s, Venturus)"), so they are asserted as a
// prefix, not an equality.
const HIRING_PROFILE_RECEIPT_FIELDS: Array<[string, string]> = [
  ['tti_improvement', 'TTI'],
  ['page_load_reduction', 'PAGE_LOAD'],
  ['conversion_uplift', 'CONVERSION'],
  ['api_latency_reduction', 'API_LATENCY'],
  ['onboarding_reduction', 'ONBOARDING_TIME'],
  ['perf_delta_js', 'BUNDLE_JS'],
  ['perf_delta_css', 'BUNDLE_CSS'],
];

// projects[].stats label -> the receipt it must equal exactly.
const PROJECT_STAT_METRICS: Record<string, string> = {
  TTI: 'TTI',
  'JS BUNDLE': 'BUNDLE_JS',
  'LOAD TIME': 'PAGE_LOAD',
};

describe('performance metrics agree with the authoritative receipts', () => {
  it('no surface carries the OPPOSITE sign of a receipt', () => {
    const contradictions = METRIC_SURFACES.flatMap(([surface, text]) =>
      perfReceipts
        .filter((receipt) => text.includes(flipSign(receipt.delta)))
        .map(
          (receipt) =>
            `${surface}: ${receipt.metric} is ${receipt.delta}, found ${flipSign(receipt.delta)}`,
        ),
    );

    expect(
      contradictions,
      `a surface states the opposite sign of an authoritative receipt. This is not hypothetical: TTI shipped as -52% in perf-receipts.ts and seo.ts while projects.ts, hiring-profile.ts, the /api/ask system prompt AND the eval corpus all said +52% — so the AI answered the opposite sign from the JSON-LD on the same metric, and the eval graded it against the wrong one. A "gain" of -52% is also nonsense as English. Fix the surface, not this test.`,
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
      'the machine-readable hiring profile must quote the same numbers as the receipts. It is the endpoint llms.txt advertises to crawlers, so a wrong number here is consumed by machines and never eyeballed. Note the assertion reads the PARSED object, not the source literal: HiringProfileSchema strips unknown keys, so a field that is renamed or moved out of `receipts` vanishes from /api/erik.json silently — `undefined` here means the field is not being served at all, which is a different bug from serving it wrong.',
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
      'a rendered stat tile disagrees with the receipt it quotes. The tile is what a visitor reads; the receipt is what the AI cites. They must be the same number.',
    ).toEqual([]);
  });
});
