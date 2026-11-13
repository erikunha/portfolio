import { askErrors } from '@/content/ask-errors';
import { ASK_MAX_OUTPUT_TOKENS } from '@/lib/ask/limits';

const TRUNCATION_LINES = Object.values(askErrors).map((errors) => errors.truncation.trim());

export function isTruncatedAnswer(answer: {
  text: string;
  outputTokens?: number | undefined;
}): boolean {
  return (
    (answer.outputTokens ?? 0) >= ASK_MAX_OUTPUT_TOKENS ||
    TRUNCATION_LINES.some((line) => answer.text.includes(line))
  );
}

export function countTruncated(items: ReadonlyArray<{ truncated: boolean }>): number {
  return items.filter((item) => item.truncated).length;
}
