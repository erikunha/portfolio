export type RepeatVerdict = boolean | null;

export type StabilityInput = { id: string; verdicts: readonly RepeatVerdict[] };

export type StabilityStat = { value: number | null; reason: string | null };

export type FlippingItem = { id: string; verdicts: RepeatVerdict[] };

export type StabilitySummary = {
  repeats: number;
  items: number;
  measuredItems: number;
  unmeasuredItems: number;
  erroredRepeats: number;
  unanimousItems: number;
  flippingItems: number;
  flipRate: StabilityStat;
  flipping: FlippingItem[];
  passRatePerRepeat: Array<number | null>;
  kappaItems: number;
  kappa: StabilityStat;
  alpha: StabilityStat;
};

export type CalibrationStabilityInput = StabilityInput & { humanVerdict: boolean };

export type CalibrationStability = StabilitySummary & { agreeAllRepeats: number };

export type JudgeStability = {
  judgeRepeats: number;
  gateRepeat: number;
  corpus: StabilitySummary | null;
  calibration: CalibrationStability;
};

export const GATE_REPEAT = 1;

export const MIN_REPEATS_FOR_AGREEMENT = 2;

export const REASON_TOO_FEW_REPEATS = `needs ${MIN_REPEATS_FOR_AGREEMENT} or more judge repeats`;
export const REASON_NO_MEASURED_ITEMS = 'no item has two valid repeats';
export const REASON_ONE_CLASS = 'every verdict is one class, so chance agreement is total';

const RATE_DECIMALS = 4;
const ORDERINGS_PER_PAIR = 2;
const PERCENT = 100;
const STAT_DECIMALS = 3;
const SEQUENCE_CODES = { pass: 'P', fail: 'F', errored: 'E' } as const;
const LABEL_WIDTH = 19;
const INDENT = '  ';
const FIELD_INDENT = `${INDENT}${INDENT}`;

function round(value: number): number {
  return Number(value.toFixed(RATE_DECIMALS));
}

function stat(value: number): StabilityStat {
  return { value: round(value), reason: null };
}

function undefinedStat(reason: string): StabilityStat {
  return { value: null, reason };
}

function validOf(verdicts: readonly RepeatVerdict[]): boolean[] {
  return verdicts.filter((v): v is boolean => v !== null);
}

function fleissKappa(items: readonly StabilityInput[], repeats: number): StabilityStat {
  if (items.length === 0) return undefinedStat(REASON_NO_MEASURED_ITEMS);
  const raters = repeats;
  let agreementSum = 0;
  let passTotal = 0;
  for (const item of items) {
    const passes = validOf(item.verdicts).filter(Boolean).length;
    const fails = raters - passes;
    agreementSum += (passes * passes + fails * fails - raters) / (raters * (raters - 1));
    passTotal += passes;
  }
  const meanAgreement = agreementSum / items.length;
  const passShare = passTotal / (items.length * raters);
  const chance = passShare ** 2 + (1 - passShare) ** 2;
  if (chance === 1) return undefinedStat(REASON_ONE_CLASS);
  return stat((meanAgreement - chance) / (1 - chance));
}

function krippendorffAlpha(items: readonly StabilityInput[]): StabilityStat {
  let passCount = 0;
  let failCount = 0;
  let observedDisagreement = 0;
  let valueCount = 0;
  for (const item of items) {
    const valid = validOf(item.verdicts);
    if (valid.length < MIN_REPEATS_FOR_AGREEMENT) continue;
    const passes = valid.filter(Boolean).length;
    const fails = valid.length - passes;
    passCount += passes;
    failCount += fails;
    valueCount += valid.length;
    observedDisagreement += (ORDERINGS_PER_PAIR * passes * fails) / (valid.length - 1);
  }
  if (valueCount === 0) return undefinedStat(REASON_NO_MEASURED_ITEMS);
  const expectedDisagreement = ORDERINGS_PER_PAIR * passCount * failCount;
  if (expectedDisagreement === 0) return undefinedStat(REASON_ONE_CLASS);
  return stat(1 - ((valueCount - 1) * observedDisagreement) / expectedDisagreement);
}

export function summarizeStability(
  items: readonly StabilityInput[],
  repeats: number,
): StabilitySummary {
  for (const item of items) {
    if (item.verdicts.length !== repeats) {
      throw new Error(
        `judge stability: item "${item.id}" has ${item.verdicts.length} verdicts, expected ${repeats}`,
      );
    }
  }

  const erroredRepeats = items.reduce(
    (sum, item) => sum + item.verdicts.filter((v) => v === null).length,
    0,
  );
  const measured = items.filter(
    (item) => validOf(item.verdicts).length >= MIN_REPEATS_FOR_AGREEMENT,
  );
  const flipping = measured.filter((item) => new Set(validOf(item.verdicts)).size > 1);
  const complete = items.filter((item) => validOf(item.verdicts).length === repeats);

  const passRatePerRepeat = Array.from({ length: repeats }, (_, repeat) => {
    const valid = items
      .map((item) => item.verdicts[repeat])
      .filter((v): v is boolean => v !== null && v !== undefined);
    return valid.length === 0 ? null : round(valid.filter(Boolean).length / valid.length);
  });

  const enough = repeats >= MIN_REPEATS_FOR_AGREEMENT;
  let flipRate = undefinedStat(REASON_TOO_FEW_REPEATS);
  if (enough) {
    flipRate =
      measured.length === 0
        ? undefinedStat(REASON_NO_MEASURED_ITEMS)
        : stat(flipping.length / measured.length);
  }

  return {
    repeats,
    items: items.length,
    measuredItems: measured.length,
    unmeasuredItems: items.length - measured.length,
    erroredRepeats,
    unanimousItems: measured.length - flipping.length,
    flippingItems: flipping.length,
    flipRate,
    flipping: flipping.map((item) => ({ id: item.id, verdicts: [...item.verdicts] })),
    passRatePerRepeat,
    kappaItems: complete.length,
    kappa: enough ? fleissKappa(complete, repeats) : undefinedStat(REASON_TOO_FEW_REPEATS),
    alpha: enough ? krippendorffAlpha(items) : undefinedStat(REASON_TOO_FEW_REPEATS),
  };
}

export function summarizeCalibrationStability(
  items: readonly CalibrationStabilityInput[],
  repeats: number,
): CalibrationStability {
  const agreeAllRepeats = items.filter(
    (item) => item.verdicts.length > 0 && item.verdicts.every((v) => v === item.humanVerdict),
  ).length;
  return { ...summarizeStability(items, repeats), agreeAllRepeats };
}

function percentText(value: number): string {
  return `${(value * PERCENT).toFixed(1)}%`;
}

function field(label: string, text: string): string {
  return `${FIELD_INDENT}${label.padEnd(LABEL_WIDTH)}${text}`;
}

function statText(value: StabilityStat): string {
  return value.value === null ? `n/a (${value.reason})` : value.value.toFixed(STAT_DECIMALS);
}

function sequenceText(verdicts: readonly RepeatVerdict[]): string {
  return verdicts
    .map((v) => {
      if (v === null) return SEQUENCE_CODES.errored;
      return v ? SEQUENCE_CODES.pass : SEQUENCE_CODES.fail;
    })
    .join(' ');
}

function summaryLines(summary: StabilitySummary): string[] {
  const flipRate =
    summary.flipRate.value === null
      ? `n/a (${summary.flipRate.reason})`
      : `${summary.flippingItems}/${summary.measuredItems} items (${percentText(summary.flipRate.value)})`;
  const lines = [
    field(
      'items judged',
      `${summary.items} (${summary.unmeasuredItems} unmeasured, ${summary.erroredRepeats} errored repeats)`,
    ),
    field('flip rate', flipRate),
    field('Fleiss kappa', statText(summary.kappa)),
    field('Krippendorff alpha', statText(summary.alpha)),
    field(
      'pass rate/repeat',
      summary.passRatePerRepeat.map((r) => (r === null ? 'n/a' : percentText(r))).join(' '),
    ),
  ];
  if (summary.flipping.length > 0) {
    lines.push(
      field(
        'flipping',
        summary.flipping.map((f) => `${f.id} [${sequenceText(f.verdicts)}]`).join(', '),
      ),
    );
  }
  return lines;
}

export function formatJudgeStability(stability: JudgeStability, judgeCostUsd: number): string[] {
  const lines = [
    `Judge stability (k=${stability.judgeRepeats})`,
    `${INDENT}grades and gates use repeat ${stability.gateRepeat}`,
  ];
  if (stability.corpus === null) {
    lines.push(`${INDENT}${'corpus'.padEnd(LABEL_WIDTH)}not run`);
  } else {
    lines.push(`${INDENT}corpus`, ...summaryLines(stability.corpus));
  }
  lines.push(
    `${INDENT}calibration`,
    ...summaryLines(stability.calibration),
    `${FIELD_INDENT}agree with human in all ${stability.judgeRepeats} repeats ${stability.calibration.agreeAllRepeats}/${stability.calibration.items}`,
    `${INDENT}judge cost ~$${judgeCostUsd} (${stability.judgeRepeats} judge calls per item)`,
  );
  return lines;
}
