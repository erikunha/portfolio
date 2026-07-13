import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { perfReceipts } from '@/content/perf-receipts';
import { projects } from '@/content/projects';
import { PerfReceiptSchema } from '@/content/schemas';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';
import { HIRING_PROFILE } from '@/lib/hiring-profile';
import { isPublishedSurface, readContentSurfaces } from './helpers/content-surfaces';

vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--font-mock', className: 'mock' }),
}));

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

const contentSurfaces: Array<[string, string]> = readContentSurfaces();

// behavioral-test-allow: the OG card's numbers are baked into an HTML template string inside the
// generator script, so they are reachable only as source text — there is nothing to import
const ogImageScript = readFileSync(path.join(REPO_ROOT, 'scripts/generate-og-image.ts'), 'utf-8');

let layoutMetadataText = '';

const METRIC_SURFACES = (): Array<[string, string]> => [
  ...contentSurfaces,
  ['lib/hiring-profile.ts (served at /api/erik.json)', JSON.stringify(HIRING_PROFILE)],
  ['lib/ask/system-prompt.ts (what the AI answers with)', SYSTEM_TEXT],
  ['public/llms.txt', read('public/llms.txt')],
  ['public/.well-known/agent.json', read('public/.well-known/agent.json')],
  ['scripts/generate-og-image.ts (social preview card)', ogImageScript],
  ['app/layout.tsx (metadata)', layoutMetadataText],
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

beforeAll(async () => {
  const { metadata } = await import('@/app/layout');
  layoutMetadataText = JSON.stringify(metadata);
});

describe('performance metrics agree with the authoritative receipts', () => {
  it('every swept surface has content, so none can degrade to a silent no-op', () => {
    const empty = METRIC_SURFACES()
      .filter(([, text]) => text.trim().length === 0)
      .map(([surface]) => surface);

    expect(
      empty,
      'a surface swept for contradictions is EMPTY, so the sweep over it finds nothing and passes — a silent no-op, not a pass. `app/layout.tsx (metadata)` is the live risk: layoutMetadataText starts as "" and is filled in beforeAll, so if that import fails or app/layout ever exports {}, this gate quietly stops covering it and nothing says so. Fix the surface, not this assertion.',
    ).toEqual([]);
  });

  it('the surface predicate judges by BASENAME, so a nested module cannot escape the sweep', () => {
    const misjudged = (
      [
        ['hero.ts', true],
        ['nested/hero.ts', true],
        ['_drafts/projects.ts', true],
        ['schemas.ts', false],
        ['nested/schemas.ts', false],
        ['_validate-client-content.ts', false],
        ['sub/_helper.ts', false],
        ['schemas.test.ts', false],
        ['README.md', false],
        ['_drafts', false],
      ] as Array<[string, boolean]>
    ).filter(([file, published]) => isPublishedSurface(file) !== published);

    expect(
      misjudged,
      'CONTENT_INFRA must be tested against the BASENAME, never the path readdirSync returns. Matched against the full relative path, `_.+` greedily eats the directory separator: "_drafts/projects.ts" — real published content under an underscore-prefixed DIRECTORY — is then silently EXCLUDED from the sweep (a fail-open, the exact class this file exists to close), while genuine nested infra like "sub/_helper.ts" is swept. It is wrong in both directions at once. The bare "_drafts" and "README.md" rows are the directory entry and the non-TS file that readdirSync also returns; dropping the extension check admits them and the sweep then tries to read a directory. This predicate is the SINGLE one both gates import (__tests__/helpers/content-surfaces.ts) — when it was duplicated per file, adding an exclusion to one copy diverged the two sweeps with both tables still green.',
    ).toEqual([]);
  });

  it('the schema forbids any delta flipSign cannot flip into a searchable token', () => {
    const rejected = [
      '10%',
      '-40% build time',
      '-97.5% (40s→<1s, Venturus)',
      '-25',
      'build time -40%',
      ' -40%',
      '-40 %',
      '−25%',
    ].filter(
      (delta) =>
        PerfReceiptSchema.safeParse({
          metric: 'BUNDLE_JS',
          delta,
          company: '@ ACME',
          note: 'x.',
        }).success,
    );

    expect(
      rejected,
      'PerfReceiptSchema must reject every delta that is not a bare signed percentage. flipSign() flips the sign and the sweep searches each surface for that literal string, so the delta has to be a token a surface can literally contain. An unsigned "10%" flips to "-0%"; a trailing gloss "-40% build time" flips to "+40% build time"; a LEADING gloss "build time -40%" flips to "-uild time -40%" — all strings no surface holds, so the sweep for that metric silently passes forever instead of failing. DO NOT TRIM THIS LIST without recomputing the mutant kill-matrix; almost every case is the sole or joint guard of a distinct loosening. Sole killers: "10%" (optional sign), "-25" (optional `%`), "-40 %" (space before the `%`), " -40%" (leading whitespace). Joint-and-only killers: the two TRAILING glosses "-40% build time" and "-97.5% (40s→<1s, Venturus)" are the ONLY two cases that kill a dropped `$` anchor — delete both and the schema can drop `$`, accept a trailing gloss, and that metric silently stops being swept forever. Keep at least one; "-97.5% (…)" is the live idiom in lib/hiring-profile.ts one import away. "−25%" (U+2212) matters differently: its flip is the TRUE value "-25%" that every surface contains, so it would cause a false-positive storm rather than a no-op. The ONLY strictly dominated case is the LEADING gloss "build time -40%" (" -40%" kills everything it kills); it is kept purely as documentation of a shape a human types. Fix the schema (or move the gloss to `note`), not this test.',
    ).toEqual([]);
  });

  it('INITIAL_LOAD matches "initial page load" but never "load time"', () => {
    expect(
      METRIC_KEYWORDS.INITIAL_LOAD?.test('initial page load'),
      'INITIAL_LOAD must match "initial page load". A `.` matches ONE character and " page " is six, so the narrower /initial.load/ walks straight past it and that receipt goes unswept.',
    ).toBe(true);

    expect(
      METRIC_KEYWORDS.INITIAL_LOAD?.test('load time'),
      'INITIAL_LOAD must NOT match "load time" — that is PAGE_LOAD\'s own rendered tile label (content/projects.ts). Widening INITIAL_LOAD to claim it reds the real LOAD TIME tile as a fake contradiction, which is exactly the false positive a74ce37 fixed. This guards the upper bound; the assertion above guards the lower one.',
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
    const contradictions = METRIC_SURFACES().flatMap(([surface, text]) =>
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
      'the machine-readable hiring profile must quote the same numbers as the receipts. It is the endpoint llms.txt advertises to crawlers, so a wrong number here is consumed by machines and never eyeballed. This reads the PARSED object, not the source literal: HiringProfileSchema strips unknown keys, so `undefined` means the field is not being SERVED AT ALL — a different bug from serving it wrong, and one that renaming a field out of `receipts` causes silently.\n\nMatched as a PREFIX, deliberately: three served values carry a legitimate trailing gloss ("-97.5% (40s→<1s, Venturus)"). Do NOT "tighten" startsWith to === — it reds three true fields, and the tempting next step is deleting the glosses from /api/erik.json, which is real information a recruiter reads. The receipt is the prefix; the gloss is allowed to follow it.',
    ).toEqual([]);
  });

  it('no PROJECT_STAT_METRICS key is orphaned, so a rename cannot drop a tile from the gate', () => {
    const orphaned = Object.keys(PROJECT_STAT_METRICS).filter(
      (label) => !projects.some((project) => project.stats.some((stat) => stat.label === label)),
    );

    expect(
      orphaned,
      'a stat label in PROJECT_STAT_METRICS matches no rendered tile, so it was renamed — and the tile it used to guard has silently LEFT the magnitude gate: an unmapped label is SKIPPED, not failed. These labels are display copy and they do move; this branch itself renamed "TTI GAIN" to "TTI". If the tile was RENAMED, re-point the key at the new label — deleting the entry there would drop a live tile out of the magnitude gate. Delete the entry ONLY if the tile is genuinely gone from the UI. Either way, do not "fix" this by deleting the assertion: the sign sweep still covers projects.ts, but magnitude is held ONLY here.',
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
