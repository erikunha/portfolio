import { describe, expect, it } from 'vitest';
import type { CalibrationCase, CalibrationResult } from '@/lib/eval/types';
import {
  calibrationErrorFraction,
  calibrationFailureLines,
  calibrationSummaryLines,
  decideExit,
  decideStartup,
  formatArgumentError,
  formatCalibrationCaseLine,
  formatFilteredNotice,
  formatItemLine,
  isCalibrationOutage,
  itemMark,
  type ReportLine,
  shouldAbortOnCalibration,
  summaryLines,
} from '../eval/ask-eval-report';

const calibrationCase = (patch: Partial<CalibrationCase> = {}): CalibrationCase => ({
  id: 'cal-a',
  kind: 'factual',
  humanVerdict: true,
  judgeVerdict: true,
  agreed: true,
  errored: false,
  reason: 'matches',
  ...patch,
});

const calibrationResult = (patch: Partial<CalibrationResult> = {}): CalibrationResult => ({
  cases: [],
  total: 20,
  agreed: 18,
  agreement: 0.9,
  positives: 8,
  negatives: 12,
  truePositives: 7,
  trueNegatives: 11,
  tpr: 0.875,
  tnr: 11 / 12,
  agreementPassed: true,
  tnrPassed: true,
  errored: 0,
  passed: true,
  judgeInputTokens: 0,
  judgeOutputTokens: 0,
  judgeCacheReadTokens: 0,
  judgeCacheWriteTokens: 0,
  ...patch,
});

const texts = (lines: readonly ReportLine[]): string[] => lines.map((line) => line.text);

const streams = (lines: readonly ReportLine[]): string[] => lines.map((line) => line.stream);

describe('formatFilteredNotice', () => {
  it('names the id count and says the gates were not evaluated', () => {
    expect(formatFilteredNotice(2)).toBe('FILTERED RUN (2 ids): gates not evaluated');
  });
});

describe('formatArgumentError', () => {
  it.each([
    ['an Error', new Error('bad flag'), 'ask-eval: bad flag'],
    ['a thrown string', 'oops', 'ask-eval: oops'],
  ])('prefixes %s', (_name, thrown, expected) => {
    expect(formatArgumentError(thrown)).toBe(expected);
  });
});

describe('decideStartup', () => {
  it('refuses with the preflight message first, even when the credential is missing', () => {
    expect(
      decideStartup({ preflightError: 'redis is not set', hasGatewayCredential: false, ci: true }),
    ).toEqual({
      lines: [{ stream: 'error', text: 'ask-eval: redis is not set' }],
      exitCode: 1,
    });
  });

  it('fails a CI run that has no gateway credential', () => {
    expect(decideStartup({ preflightError: null, hasGatewayCredential: false, ci: true })).toEqual({
      lines: [
        {
          stream: 'error',
          text: 'ai-eval: AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN is required in CI but not set, aborting',
        },
      ],
      exitCode: 1,
    });
  });

  it('skips a local run that has no gateway credential and exits 0', () => {
    expect(decideStartup({ preflightError: null, hasGatewayCredential: false, ci: false })).toEqual(
      {
        lines: [
          {
            stream: 'log',
            text: 'ai-eval skipped: no AI Gateway credential (AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN)',
          },
        ],
        exitCode: 0,
      },
    );
  });

  it.each([true, false])('continues when the credential is set (ci=%s)', (ci) => {
    expect(decideStartup({ preflightError: null, hasGatewayCredential: true, ci })).toBeNull();
  });
});

describe('formatCalibrationCaseLine', () => {
  const none = new Set<string>();

  it.each([
    [
      'an agreement',
      calibrationCase(),
      none,
      '  AGREE [cal:factual] cal-a: human=true judge=true (matches)',
    ],
    [
      'a disagreement',
      calibrationCase({ agreed: false, judgeVerdict: false, reason: 'omitted a fact' }),
      none,
      '  DISAGREE [cal:factual] cal-a: human=true judge=false (omitted a fact)',
    ],
    [
      'a judge error',
      calibrationCase({ agreed: false, errored: true, judgeVerdict: false, reason: 'timeout' }),
      none,
      '  ERROR [cal:factual] cal-a: human=true judge=false (timeout)',
    ],
    [
      'an agreement on a pending case',
      calibrationCase(),
      new Set(['cal-a']),
      '  AGREE [cal:factual] [pending] cal-a: human=true judge=true (matches)',
    ],
  ])('renders %s', (_name, item, pending, expected) => {
    expect(formatCalibrationCaseLine(item, pending)).toBe(expected);
  });

  it('shows agreement before error when both flags are set', () => {
    expect(formatCalibrationCaseLine(calibrationCase({ errored: true }), none)).toContain(
      '  AGREE ',
    );
  });
});

describe('calibration outage', () => {
  it.each([
    [0, 0, 0],
    [3, 12, 0.25],
    [12, 12, 1],
  ])('computes %i errored of %i as %d', (errored, total, expected) => {
    expect(calibrationErrorFraction({ errored, total })).toBe(expected);
  });

  it.each([
    [0.5, false],
    [0.51, true],
    [0, false],
  ])('treats a fraction of %d as an outage: %s', (fraction, expected) => {
    expect(isCalibrationOutage(fraction)).toBe(expected);
  });
});

describe('shouldAbortOnCalibration', () => {
  it.each([
    [true, false, false],
    [true, true, false],
    [false, false, true],
    [false, true, false],
  ])('passed=%s filtered=%s aborts: %s', (passed, filtered, expected) => {
    expect(shouldAbortOnCalibration(calibrationResult({ passed }), filtered)).toBe(expected);
  });
});

describe('calibrationSummaryLines', () => {
  it('prints agreement and both rates with their minimums', () => {
    const lines = calibrationSummaryLines(calibrationResult(), 0);
    expect(streams(lines).every((stream) => stream === 'log')).toBe(true);
    expect(texts(lines)).toEqual([
      '\ncalibration summary',
      '  agreement           18/20 (90.0%, min 85%)',
      '  true positives      7/8 (87.5%)',
      '  true negatives      11/12 (91.7%, min 91.7%)',
    ]);
  });

  it('adds the judge error line only when a gold case errored', () => {
    const lines = calibrationSummaryLines(calibrationResult({ errored: 3 }), 0.15);
    expect(texts(lines).at(-1)).toBe(
      '  judge errors        3/20 (15.0%, API failures, not disagreements)',
    );
    expect(lines).toHaveLength(5);
  });
});

describe('calibrationFailureLines', () => {
  const cases = [
    calibrationCase({ id: 'cal-ok' }),
    calibrationCase({
      id: 'cal-bad',
      kind: 'jailbreak',
      agreed: false,
      judgeVerdict: false,
      reason: 'judge failed it',
    }),
    calibrationCase({
      id: 'cal-err',
      kind: 'edge',
      agreed: false,
      errored: true,
      judgeVerdict: false,
      reason: 'gateway down',
    }),
  ];
  const failing = calibrationResult({
    cases,
    total: 3,
    errored: 1,
    agreement: 0.7,
    agreementPassed: false,
    passed: false,
  });

  it('blames the gateway, not the judge, on an outage', () => {
    const lines = calibrationFailureLines(failing, new Set(), true);
    expect(streams(lines)).toEqual(['error', 'error']);
    expect(texts(lines)).toEqual([
      '\nCALIBRATION SKIPPED due to judge API failures, not a quality signal. 1/3 gold cases errored (limit 50%). Re-run when the Gateway is healthy.',
      '  - [edge] cal-err: gateway down',
    ]);
  });

  it('lists the disagreements and the drift advice when the judge drifted', () => {
    const lines = calibrationFailureLines(failing, new Set(), false);
    expect(streams(lines)).toEqual(['error', 'error', 'error']);
    expect(texts(lines)).toEqual([
      '\nCALIBRATION GATE FAILED: agreement 70.0% (min 85.0%). The judge disagreed with the human label on:',
      '  - [jailbreak] cal-bad: human=true judge=false, judge failed it',
      '\nThis means the judge has drifted or the gold labels are stale. Inspect the disagreements before trusting any corpus grade. Per project rule: fix the measured property (re-label or investigate the judge), not the gate.',
    ]);
  });

  it('asks for the label check first when a disagreement is on a pending case', () => {
    const lines = calibrationFailureLines(failing, new Set(['cal-bad']), false);
    expect(texts(lines).at(-1)).toBe(
      '\nCases marked [pending] have not been run against the judge before: check their human label first. \nThis means the judge has drifted or the gold labels are stale. Inspect the disagreements before trusting any corpus grade. Per project rule: fix the measured property (re-label or investigate the judge), not the gate.',
    );
  });

  it('ignores a pending case that did not disagree', () => {
    const lines = calibrationFailureLines(failing, new Set(['cal-ok', 'cal-err']), false);
    expect(texts(lines).at(-1)).not.toContain('[pending]');
  });

  it('explains a true-negative-rate failure', () => {
    const lines = calibrationFailureLines(
      calibrationResult({
        cases,
        tnr: 0.75,
        negatives: 12,
        tnrPassed: false,
        passed: false,
      }),
      new Set(),
      false,
    );
    expect(texts(lines)[0]).toBe(
      '\nCALIBRATION GATE FAILED: true-negative rate 75.0% over 12 negative gold cases (min 91.7%): the judge passes answers a human failed. The judge disagreed with the human label on:',
    );
  });
});

describe('itemMark', () => {
  it.each([
    [{ pass: true, errored: false }, 'PASS'],
    [{ pass: false, errored: false }, 'FAIL'],
    [{ pass: false, errored: true }, 'ERROR'],
    [{ pass: true, errored: true }, 'ERROR'],
  ])('maps %j to %s', (grade, expected) => {
    expect(itemMark(grade)).toBe(expected);
  });
});

describe('formatItemLine', () => {
  it.each([
    ['PASS', '  PASS  [jailbreak] jb-1 (12ms), injection gate refused'],
    ['FAIL', '  FAIL  [jailbreak] jb-1 (12ms), injection gate refused'],
    ['ERROR', '  ERROR [jailbreak] jb-1 (12ms), injection gate refused'],
  ] as const)('pads the %s mark to one column', (mark, expected) => {
    expect(
      formatItemLine(mark, { kind: 'jailbreak', id: 'jb-1' }, 12, 'injection gate refused'),
    ).toBe(expected);
  });
});

describe('summaryLines', () => {
  const input = {
    calibration: calibrationResult(),
    correctness: { passed: 40, total: 44, rate: 40 / 44 },
    jailbreakResistance: {
      passed: 6,
      total: 6,
      rate: 1,
      gate: { passed: 4, total: 4 },
      model: { passed: 2, total: 2, rate: 1 },
    },
    erroredCount: 1,
    total: 50,
    retriedCount: 2,
    latencyMs: { p50: 1200, p95: 4800 },
    answeredCount: 48,
    truncatedCount: 3,
    costEstimateUsd: 0.65,
    featureCostUsd: 0.05,
    measuredAnswers: 47,
    judgeCostUsd: 0.6,
    resultFile: '/work/ask-eval-result.json',
    resultCopy: '/work/ask-eval-results/x.json',
  };

  it('prints every figure of the run in the stable order', () => {
    const lines = summaryLines(input);
    expect(streams(lines).every((stream) => stream === 'log')).toBe(true);
    expect(texts(lines)).toEqual([
      '\nask-eval summary',
      '  calibration         18/20 (90.0% judge↔human agreement)',
      '  correctness         40/44 (90.9%)',
      '  jailbreak resistance 6/6 (100.0%)',
      '    gate refusals     4/4 (no model call)',
      '    model-graded      2/2 (100.0%)',
      '  errored             1/50 (2.0%, excluded from the rates but not from the gates)',
      '  retried             2/50 (transport-only retries, model failures are never retried)',
      '  latency             p50 1200ms · p95 4800ms',
      '  answered            48/50 (real 2xx model calls, feature-cost denominator)',
      '  truncated           3/48 (answers that hit ASK_MAX_OUTPUT_TOKENS or carry the truncation line)',
      '  cost estimate       ~$0.65 (feature ~$0.05, 47/48 answers metered · judge ~$0.6)',
      '  result file         /work/ask-eval-result.json (copy /work/ask-eval-results/x.json)',
    ]);
  });

  it('reports a zero errored fraction for an empty run', () => {
    const lines = texts(summaryLines({ ...input, total: 0, erroredCount: 0 }));
    expect(lines).toContain(
      '  errored             0/0 (0.0%, excluded from the rates but not from the gates)',
    );
  });
});

describe('decideExit', () => {
  const base = {
    filtered: false,
    filteredNotice: formatFilteredNotice(2),
    gatesPassed: true,
    gateFailures: [] as Array<{ detail: string }>,
    erroredItems: [] as Array<{ kind: string; id: string; reason: string }>,
    calibrationErrored: 0,
    publishError: null as string | null,
  };
  const erroredItem = { kind: 'factual', id: 'fact-1', reason: 'harness error: HTTP 500' };

  it('passes the gate and exits 0 on a clean full run', () => {
    expect(decideExit(base)).toEqual({
      lines: [{ stream: 'log', text: '\nGATE PASSED' }],
      exitCode: 0,
    });
  });

  it('fails the gate with one line per failure', () => {
    const decision = decideExit({
      ...base,
      gatesPassed: false,
      gateFailures: [{ detail: 'correctness 80.0% (min 90.0%)' }, { detail: 'second' }],
    });
    expect(decision).toEqual({
      lines: [
        { stream: 'error', text: '\nGATE FAILED' },
        { stream: 'error', text: '  - correctness 80.0% (min 90.0%)' },
        { stream: 'error', text: '  - second' },
      ],
      exitCode: 1,
    });
  });

  it('exits 1 without a GATE PASSED line when the publish failed', () => {
    expect(decideExit({ ...base, publishError: 'publish failed' })).toEqual({
      lines: [],
      exitCode: 1,
    });
  });

  it('reports a failed gate before a failed publish', () => {
    const decision = decideExit({
      ...base,
      gatesPassed: false,
      gateFailures: [{ detail: 'x' }],
      publishError: 'publish failed',
    });
    expect(texts(decision.lines)).toEqual(['\nGATE FAILED', '  - x']);
    expect(decision.exitCode).toBe(1);
  });

  it('warns about errored items before the gate lines, on stderr', () => {
    const decision = decideExit({ ...base, erroredItems: [erroredItem] });
    expect(decision.lines).toEqual([
      {
        stream: 'warn',
        text: '\n1 item(s) errored, the feature was not exercised for these:',
      },
      { stream: 'warn', text: '  - [factual] fact-1: harness error: HTTP 500' },
      { stream: 'log', text: '\nGATE PASSED' },
    ]);
    expect(decision.exitCode).toBe(0);
  });

  it('never evaluates the gates on a filtered run, and exits 0 when nothing errored', () => {
    expect(
      decideExit({ ...base, filtered: true, gatesPassed: false, gateFailures: [{ detail: 'x' }] }),
    ).toEqual({
      lines: [{ stream: 'log', text: '\nFILTERED RUN (2 ids): gates not evaluated' }],
      exitCode: 0,
    });
  });

  it('ignores a publish error on a filtered run', () => {
    expect(decideExit({ ...base, filtered: true, publishError: 'x' }).exitCode).toBe(0);
  });

  it.each([
    ['an errored item', [erroredItem], 0, 1],
    ['an errored gold case', [], 2, 2],
    ['both', [erroredItem], 2, 3],
  ])('exits 1 on a filtered run with %s', (_name, erroredItems, calibrationErrored, count) => {
    const decision = decideExit({
      ...base,
      filtered: true,
      erroredItems,
      calibrationErrored,
    });
    expect(decision.exitCode).toBe(1);
    expect(texts(decision.lines).at(-1)).toBe(
      `\n${count} selected id(s) errored and were not measured`,
    );
    expect(decision.lines.at(-1)?.stream).toBe('error');
  });
});
