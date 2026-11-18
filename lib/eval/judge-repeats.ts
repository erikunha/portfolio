import { isJudgeError, type JudgeItem, judge } from '@/lib/eval/judge';
import type { RepeatVerdict } from '@/lib/eval/judge-stability';
import type { JudgeVerdict } from '@/lib/eval/types';

export const JUDGE_REPEATS_FLAG = '--judge-repeats';

export const DEFAULT_JUDGE_REPEATS = 1;

export const MAX_JUDGE_REPEATS = 10;

const WHOLE_NUMBER = /^\d+$/;

function invalid(received: string | undefined): Error {
  return new Error(
    `${JUDGE_REPEATS_FLAG} must be an integer from ${DEFAULT_JUDGE_REPEATS} to ${MAX_JUDGE_REPEATS}, got ${received === undefined ? 'no value' : JSON.stringify(received)}`,
  );
}

export function parseJudgeRepeats(argv: readonly string[]): number {
  const inline = `${JUDGE_REPEATS_FLAG}=`;
  let raw: string | undefined;
  let present = false;
  for (const [index, arg] of argv.entries()) {
    if (arg === JUDGE_REPEATS_FLAG) {
      present = true;
      const next = argv[index + 1];
      raw = next?.startsWith('--') ? undefined : next;
    } else if (arg.startsWith(inline)) {
      present = true;
      raw = arg.slice(inline.length);
    }
  }
  if (!present) return DEFAULT_JUDGE_REPEATS;
  if (raw === undefined || !WHOLE_NUMBER.test(raw)) throw invalid(raw);
  const repeats = Number(raw);
  if (repeats < DEFAULT_JUDGE_REPEATS || repeats > MAX_JUDGE_REPEATS) throw invalid(raw);
  return repeats;
}

export async function judgeRepeated(
  item: JudgeItem,
  answer: string,
  opts: { model: string; factSheet?: string },
  repeats: number,
): Promise<JudgeVerdict[]> {
  const first = await judge(item, answer, opts);
  if (repeats <= DEFAULT_JUDGE_REPEATS) return [first];
  const rest = await Promise.all(
    Array.from({ length: repeats - DEFAULT_JUDGE_REPEATS }, () => judge(item, answer, opts)),
  );
  return [first, ...rest];
}

export function verdictSequence(verdicts: readonly JudgeVerdict[]): RepeatVerdict[] {
  return verdicts.map((v) => (isJudgeError(v.reason) ? null : v.pass));
}

export function reasonSequence(verdicts: readonly JudgeVerdict[]): string[] {
  return verdicts.map((v) => v.reason);
}
