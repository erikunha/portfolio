import type { GradeSummary } from '@/lib/eval/ask-grading';
import {
  CALIBRATION_ERROR_FRACTION_LIMIT,
  describeCalibrationFailure,
  MIN_CALIBRATION_AGREEMENT,
  MIN_CALIBRATION_TNR,
} from '@/lib/eval/calibration';
import type { CalibrationCase, CalibrationResult } from '@/lib/eval/types';

export type ReportLine = { stream: 'log' | 'warn' | 'error'; text: string };

export type Decision = { lines: ReportLine[]; exitCode: number };

type ItemMark = 'PASS' | 'FAIL' | 'ERROR';

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const PERCENT = 100;
const PERCENT_DIGITS = 1;
const MARK_WIDTH = 5;

const pct = (value: number): string => (value * PERCENT).toFixed(PERCENT_DIGITS);

const log = (text: string): ReportLine => ({ stream: 'log', text });
const warn = (text: string): ReportLine => ({ stream: 'warn', text });
const error = (text: string): ReportLine => ({ stream: 'error', text });

export const formatFilteredNotice = (idCount: number): string =>
  `FILTERED RUN (${idCount} ids): gates not evaluated`;

export const formatArgumentError = (thrown: unknown): string =>
  `ask-eval: ${thrown instanceof Error ? thrown.message : String(thrown)}`;

export function decideStartup(input: {
  preflightError: string | null;
  hasGatewayCredential: boolean;
  ci: boolean;
}): Decision | null {
  if (input.preflightError) {
    return { lines: [error(`ask-eval: ${input.preflightError}`)], exitCode: EXIT_FAILURE };
  }
  if (input.hasGatewayCredential) return null;
  if (input.ci) {
    return {
      lines: [
        error(
          'ai-eval: AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN is required in CI but not set, aborting',
        ),
      ],
      exitCode: EXIT_FAILURE,
    };
  }
  return {
    lines: [
      log('ai-eval skipped: no AI Gateway credential (AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN)'),
    ],
    exitCode: EXIT_OK,
  };
}

export function formatCalibrationCaseLine(
  item: CalibrationCase,
  pendingIds: ReadonlySet<string>,
): string {
  const disagreeMark = item.errored ? 'ERROR' : 'DISAGREE';
  const mark = item.agreed ? 'AGREE' : disagreeMark;
  const pendingMark = pendingIds.has(item.id) ? ' [pending]' : '';
  return `  ${mark} [cal:${item.kind}]${pendingMark} ${item.id}: human=${item.humanVerdict} judge=${item.judgeVerdict} (${item.reason})`;
}

export const calibrationErrorFraction = (
  calibration: Pick<CalibrationResult, 'errored' | 'total'>,
): number => (calibration.total > 0 ? calibration.errored / calibration.total : 0);

export const isCalibrationOutage = (errorFraction: number): boolean =>
  errorFraction > CALIBRATION_ERROR_FRACTION_LIMIT;

export const shouldAbortOnCalibration = (
  calibration: Pick<CalibrationResult, 'passed'>,
  filtered: boolean,
): boolean => !calibration.passed && !filtered;

export function calibrationSummaryLines(
  calibration: CalibrationResult,
  errorFraction: number,
): ReportLine[] {
  const lines = [
    log('\ncalibration summary'),
    log(
      `  agreement           ${calibration.agreed}/${calibration.total} (${pct(calibration.agreement)}%, min ${MIN_CALIBRATION_AGREEMENT * PERCENT}%)`,
    ),
    log(
      `  true positives      ${calibration.truePositives}/${calibration.positives} (${pct(calibration.tpr)}%)`,
    ),
    log(
      `  true negatives      ${calibration.trueNegatives}/${calibration.negatives} (${pct(calibration.tnr)}%, min ${pct(MIN_CALIBRATION_TNR)}%)`,
    ),
  ];
  if (calibration.errored > 0) {
    lines.push(
      log(
        `  judge errors        ${calibration.errored}/${calibration.total} (${pct(errorFraction)}%, API failures, not disagreements)`,
      ),
    );
  }
  return lines;
}

export function calibrationFailureLines(
  calibration: CalibrationResult,
  pendingIds: ReadonlySet<string>,
  outage: boolean,
): ReportLine[] {
  if (outage) {
    return [
      error(
        '\nCALIBRATION SKIPPED due to judge API failures, not a quality signal. ' +
          `${calibration.errored}/${calibration.total} gold cases errored ` +
          `(limit ${CALIBRATION_ERROR_FRACTION_LIMIT * PERCENT}%). Re-run when the Gateway is healthy.`,
      ),
      ...calibration.cases
        .filter((item) => item.errored)
        .map((item) => error(`  - [${item.kind}] ${item.id}: ${item.reason}`)),
    ];
  }
  const disagreed = calibration.cases.filter((item) => !item.agreed && !item.errored);
  return [
    error(
      `\nCALIBRATION GATE FAILED: ${describeCalibrationFailure(calibration)}. ` +
        'The judge disagreed with the human label on:',
    ),
    ...disagreed.map((item) =>
      error(
        `  - [${item.kind}] ${item.id}: human=${item.humanVerdict} judge=${item.judgeVerdict}, ${item.reason}`,
      ),
    ),
    error(
      (disagreed.some((item) => pendingIds.has(item.id))
        ? '\nCases marked [pending] have not been run against the judge before: check their human label first. '
        : '') +
        '\nThis means the judge has drifted or the gold labels are stale. ' +
        'Inspect the disagreements before trusting any corpus grade. ' +
        'Per project rule: fix the measured property (re-label or investigate the judge), not the gate.',
    ),
  ];
}

export function itemMark(grade: { pass: boolean; errored: boolean }): ItemMark {
  if (grade.errored) return 'ERROR';
  return grade.pass ? 'PASS' : 'FAIL';
}

export const formatItemLine = (
  mark: ItemMark,
  item: { kind: string; id: string },
  latencyMs: number,
  detail: string,
): string => `  ${mark.padEnd(MARK_WIDTH)} [${item.kind}] ${item.id} (${latencyMs}ms), ${detail}`;

export type SummaryInput = {
  calibration: CalibrationResult;
  correctness: GradeSummary['correctness'];
  jailbreakResistance: GradeSummary['jailbreakResistance'];
  erroredCount: number;
  total: number;
  retriedCount: number;
  latencyMs: { p50: number; p95: number };
  answeredCount: number;
  truncatedCount: number;
  costEstimateUsd: number;
  featureCostUsd: number;
  measuredAnswers: number;
  judgeCostUsd: number;
  resultFile: string;
  resultCopy: string;
};

export function summaryLines(input: SummaryInput): ReportLine[] {
  const { calibration, correctness, jailbreakResistance: jailbreak, total } = input;
  const erroredFraction = total > 0 ? input.erroredCount / total : 0;
  return [
    log('\nask-eval summary'),
    log(
      `  calibration         ${calibration.agreed}/${calibration.total} (${pct(calibration.agreement)}% judge↔human agreement)`,
    ),
    log(
      `  correctness         ${correctness.passed}/${correctness.total} (${pct(correctness.rate)}%)`,
    ),
    log(`  jailbreak resistance ${jailbreak.passed}/${jailbreak.total} (${pct(jailbreak.rate)}%)`),
    log(`    gate refusals     ${jailbreak.gate.passed}/${jailbreak.gate.total} (no model call)`),
    log(
      `    model-graded      ${jailbreak.model.passed}/${jailbreak.model.total} (${pct(jailbreak.model.rate)}%)`,
    ),
    log(
      `  errored             ${input.erroredCount}/${total} (${pct(erroredFraction)}%, excluded from the rates but not from the gates)`,
    ),
    log(
      `  retried             ${input.retriedCount}/${total} (transport-only retries, model failures are never retried)`,
    ),
    log(`  latency             p50 ${input.latencyMs.p50}ms · p95 ${input.latencyMs.p95}ms`),
    log(
      `  answered            ${input.answeredCount}/${total} (real 2xx model calls, feature-cost denominator)`,
    ),
    log(
      `  truncated           ${input.truncatedCount}/${input.answeredCount} (answers that hit ASK_MAX_OUTPUT_TOKENS or carry the truncation line)`,
    ),
    log(
      `  cost estimate       ~$${input.costEstimateUsd} (feature ~$${input.featureCostUsd}, ${input.measuredAnswers}/${input.answeredCount} answers metered · judge ~$${input.judgeCostUsd})`,
    ),
    log(`  result file         ${input.resultFile} (copy ${input.resultCopy})`),
  ];
}

export type ExitInput = {
  filtered: boolean;
  filteredNotice: string;
  gatesPassed: boolean;
  gateFailures: ReadonlyArray<{ detail: string }>;
  erroredItems: ReadonlyArray<{ kind: string; id: string; reason: string }>;
  calibrationErrored: number;
  publishError: string | null;
};

export function decideExit(input: ExitInput): Decision {
  const lines: ReportLine[] = [];
  const erroredCount = input.erroredItems.length;
  if (erroredCount > 0) {
    lines.push(
      warn(`\n${erroredCount} item(s) errored, the feature was not exercised for these:`),
      ...input.erroredItems.map((item) => warn(`  - [${item.kind}] ${item.id}: ${item.reason}`)),
    );
  }

  if (input.filtered) {
    lines.push(log(`\n${input.filteredNotice}`));
    if (erroredCount > 0 || input.calibrationErrored > 0) {
      lines.push(
        error(
          `\n${erroredCount + input.calibrationErrored} selected id(s) errored and were not measured`,
        ),
      );
      return { lines, exitCode: EXIT_FAILURE };
    }
    return { lines, exitCode: EXIT_OK };
  }

  if (!input.gatesPassed) {
    lines.push(
      error('\nGATE FAILED'),
      ...input.gateFailures.map((failure) => error(`  - ${failure.detail}`)),
    );
    return { lines, exitCode: EXIT_FAILURE };
  }
  if (input.publishError) return { lines, exitCode: EXIT_FAILURE };
  lines.push(log('\nGATE PASSED'));
  return { lines, exitCode: EXIT_OK };
}
