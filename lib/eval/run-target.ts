import { generateText } from 'ai';
import { ASK_MAX_OUTPUT_TOKENS } from '@/lib/ask/limits';

export const MONTE_CARLO_TEMPERATURE = 0.7;

export async function runTarget(
  c: { prompt: string; target: { systemText: string } },
  opts: { model: string; temperature?: number },
): Promise<{
  output: string;
  inputTokens: number;
  outputTokens: number;
  errored: boolean;
  detail?: string;
}> {
  try {
    const { text, usage } = await generateText({
      model: opts.model,
      system: c.target.systemText,
      prompt: c.prompt,
      maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
      temperature: opts.temperature ?? 0,
    });
    return {
      output: text,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      errored: false,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { output: '', inputTokens: 0, outputTokens: 0, errored: true, detail };
  }
}
