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
// (CLAUDE.md: "cite the receipts — they are the authoritative source").
//
// WHAT THIS HOLDS, precisely, because the scope is not what you would assume:
//   - The sweep catches an OPPOSITE SIGN only. It does NOT catch magnitude drift in prose:
//     changing "-25% initial load" to "-2.5%" in the system prompt passes. Do not "fix" that by
//     comparing magnitudes near a keyword — it was built twice and false-fired heavily on
//     currently-correct content both times, because a dense list ("-33% JS, -98% CSS, -52% TTI")
//     puts every metric's keyword inside the window of every OTHER metric's number. The count
//     depends on the implementation and moves with any content edit, so it is not written here.
//   - Magnitude IS held where an explicit field mapping exists: HIRING_PROFILE_RECEIPT_FIELDS and
//     PROJECT_STAT_METRICS. Prose has no such mapping, so prose gets the sign check only.
// The narrative in system-prompt.ts hand-duplicates numbers that LIVE_DATA already generates from
// perfReceipts. That duplication is what let "+25% initial load" ship. The sign half is now gated;
// the magnitude half of the narrative is not.
const receiptFor = (metric: string) => {
  const receipt = perfReceipts.find((r) => r.metric === metric);
  if (!receipt) throw new Error(`no perf receipt for ${metric}`);
  return receipt.delta;
};

const flipSign = (delta: string) =>
  delta.startsWith('-') ? `+${delta.slice(1)}` : `-${delta.slice(1)}`;

// The word a surface uses when it is talking about this metric. The sign sweep only fires when
// the flipped number sits NEXT TO one of these — see PROXIMITY_CHARS below for why.
const METRIC_KEYWORDS: Record<string, RegExp> = {
  API_LATENCY: /latency/i,
  BUNDLE_CSS: /css/i,
  TTI: /\bTTI\b|time.to.interactive/i,
  BUNDLE_JS: /\bJS\b|javascript/i,
  // "LOAD TIME" is PAGE_LOAD's own label (content/projects.ts, and PROJECT_STAT_METRICS below),
  // so the phrase belongs HERE. Giving it to INITIAL_LOAD instead collides: a true, unrelated
  // +25% beside the LOAD TIME tile then reds as a fake INITIAL_LOAD contradiction.
  PAGE_LOAD: /page[\s-]*load|load[\s-]*time/i,
  // /initial.load/ let "initial page load" escape — `.` matches ONE character and " page " is six.
  INITIAL_LOAD: /initial[\s-]*(page[\s-]*)?load/i,
  CONVERSION: /conversion/i,
  // NOT /build/i: that matches "building the frontend platform", which appears in llms.txt and the
  // system prompt, so a legitimate "+40%" anywhere near it would red as a spurious contradiction
  DESKTOP_BUILD: /desktop[\s-]*build|build[\s-]*time/i,
  ONBOARDING_TIME: /onboarding/i,
};

// A flipped number only contradicts a receipt if the sentence is ABOUT that metric. Banning the
// digits outright is what a metric-blind sweep does, and it bites: CONVERSION is +10%, so a
// global ban on "-10%" reds a true sentence like "bounce rate -10% after the redesign" — and the
// failure message would then instruct the next engineer to delete a true statement. That is the
// false-positive budget this repo refuses to spend. Requiring the metric's own keyword within
// this window keeps every real contradiction (each one sits beside its metric name) and drops
// the collisions on round numbers like 10% and 40%.
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

// Every surface that quotes a performance number, in prose or structured data. perf-receipts.ts
// sweeps ITSELF because it also exports `heroStats`, a hand-written literal that is NOT derived
// from `perfReceipts` — so the authority file is not automatically self-consistent.
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

// hiring-profile.receipts field -> the receipt it must agree with. NOT `.metrics`:
// HiringProfileSchema declares `receipts`, and .parse() STRIPS unknown keys — a field under any
// other name is silently dropped from /api/erik.json rather than served wrong. Several carry a
// trailing gloss ("-97.5% (40s->1s, Venturus)"), so they are asserted as a prefix.
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
      `a surface states the opposite sign of an authoritative receipt. Not hypothetical: TTI shipped as -52% in perf-receipts.ts and seo.ts while projects.ts, hiring-profile.ts, the /api/ask system prompt AND the eval corpus all said +52% — so the AI answered the opposite sign from the JSON-LD on the same metric, and the eval graded it against the wrong one. A "gain" of -52% is also nonsense as English.\n\nBEFORE you change any copy: this can still false-fire. It fires when the flipped number sits within ${PROXIMITY_CHARS} chars of the metric's keyword, so a TRUE sentence about a DIFFERENT metric that shares a magnitude AND sits in the same breath will trip it — e.g. "conversion work at Grupo SBF: bounce rate -10%" (CONVERSION is +10%). Proximity cannot disambiguate two metrics sharing a number inside one sentence. If that is what happened, do NOT delete the true claim and do NOT widen the keyword (it is already correct) — narrow the sentence, or add the other metric as its own receipt so it has a keyword of its own.`,
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
      'the machine-readable hiring profile must quote the same numbers as the receipts. It is the endpoint llms.txt advertises to crawlers, so a wrong number here is consumed by machines and never eyeballed. This reads the PARSED object, not the source literal: HiringProfileSchema strips unknown keys, so `undefined` means the field is not being SERVED AT ALL — a different bug from serving it wrong.',
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
