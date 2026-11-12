import { GUARD_ABORT_PREFIX } from '@/lib/ask/output-guard';
import { parseStreamChunk, REFUSAL_PREFIX } from '@/lib/stream-protocol';

export type AskStreamOutcome =
  | { kind: 'answer'; text: string }
  | { kind: 'errored'; detail: string };

export function classifyAskStream(accumulated: string): AskStreamOutcome {
  const chunk = parseStreamChunk(accumulated);
  if (chunk.ok) return { kind: 'answer', text: chunk.displayText };
  if (chunk.errorMessage.startsWith(GUARD_ABORT_PREFIX)) {
    return {
      kind: 'answer',
      text: `[ask stream errored: ${chunk.errorMessage}]\n${chunk.displayText}`.trim(),
    };
  }
  if (chunk.errorMessage.startsWith(REFUSAL_PREFIX)) {
    return {
      kind: 'answer',
      text: `${chunk.displayText}\n${chunk.errorMessage.slice(REFUSAL_PREFIX.length)}`.trim(),
    };
  }
  return { kind: 'errored', detail: `ask stream errored: ${chunk.errorMessage}` };
}
