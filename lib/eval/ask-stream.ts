import { GUARD_ABORT_PREFIX } from '@/lib/ask/output-guard';
import { parseStreamChunk } from '@/lib/stream-protocol';

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
  return { kind: 'errored', detail: `ask stream errored: ${chunk.errorMessage}` };
}
