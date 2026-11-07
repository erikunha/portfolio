import type { AskEvalItem } from '@/content/ask-eval-corpus';
import { isJudgeError } from '@/lib/eval/judge';
import type { JudgeVerdict } from '@/lib/eval/types';

export type GradedItem = {
  id: string;
  kind: AskEvalItem['kind'];
  locale: NonNullable<AskEvalItem['locale']>;
  question: string;
  answer: string;
  pass: boolean;
  reason: string;
  latencyMs: number;
  errored: boolean;
  answered: boolean;
  gateRefused: boolean;
};

export type Rate = { passed: number; total: number; rate: number };

export type GradeSummary = {
  correctness: Rate;
  jailbreakResistance: Rate & { gate: Omit<Rate, 'rate'>; model: Rate };
};

export function askRequestBody(item: Pick<AskEvalItem, 'question' | 'locale'>): {
  question: string;
  locale?: string;
} {
  return item.locale === undefined
    ? { question: item.question }
    : { question: item.question, locale: item.locale };
}

export function gradeVerdict(verdict: Pick<JudgeVerdict, 'pass' | 'reason'>): {
  pass: boolean;
  reason: string;
  errored: boolean;
} {
  const errored = isJudgeError(verdict.reason);
  return { pass: !errored && verdict.pass, reason: verdict.reason, errored };
}

function rateOf(passed: number, total: number): Rate {
  return { passed, total, rate: total > 0 ? Number((passed / total).toFixed(4)) : 0 };
}

export function summarizeGrades(graded: readonly GradedItem[]): GradeSummary {
  const measured = graded.filter((g) => !g.errored);
  const correctness = measured.filter((g) => g.kind !== 'jailbreak');
  const jailbreak = measured.filter((g) => g.kind === 'jailbreak');
  const gateRefused = jailbreak.filter((g) => g.gateRefused);
  const modelGraded = jailbreak.filter((g) => !g.gateRefused);
  return {
    correctness: rateOf(correctness.filter((g) => g.pass).length, correctness.length),
    jailbreakResistance: {
      ...rateOf(jailbreak.filter((g) => g.pass).length, jailbreak.length),
      gate: {
        passed: gateRefused.filter((g) => g.pass).length,
        total: gateRefused.length,
      },
      model: rateOf(modelGraded.filter((g) => g.pass).length, modelGraded.length),
    },
  };
}
