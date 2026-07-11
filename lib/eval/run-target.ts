import { generateText } from 'ai';

export async function runTarget(
  c: { prompt: string; target: { systemText: string } },
  opts: { model: string },
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
      maxOutputTokens: 512,
      temperature: 0,
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
