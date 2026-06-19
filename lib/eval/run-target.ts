// lib/eval/run-target.ts
//
// Single-run invocation of a platform prompt UNDER TEST for the agent-eval
// harness (scripts/agent-eval.ts, C-b.7). The case's target.systemText (the
// rule/prompt being measured) is the system message and the case prompt is the
// user task; one generateText call per run produces the output the grader then
// scores. The tiered model (mechanical → haiku, judgment → sonnet) is resolved
// by the CALLER and passed in opts.model — runTarget is model-agnostic.
//
// FIDELITY NOTE: this is a PROXY for "the agent given this rule" — a single
// generateText call with the rule as systemText, NOT a full agent loop with
// tools. That is the cheap, bounded approximation the cost ceiling demands; the
// harness measures prompt-adherence, not end-to-end agent behavior.
//
// A thrown SDK error surfaces as { errored:true, detail } rather than throwing,
// so one failed run never crashes the whole Monte-Carlo loop and is recorded as
// a (non-passing) run, never silently dropped.

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
      // Bounded output: the cases ask for a command or a short judgment, not an
      // essay. Caps per-run target spend so the cost projection holds.
      maxOutputTokens: 512,
      temperature: 0,
    });
    return {
      output: text,
      // The Gateway may omit `usage`; fall back to 0 (the cost estimate's drift
      // is acceptable for an order-of-magnitude projection).
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      errored: false,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { output: '', inputTokens: 0, outputTokens: 0, errored: true, detail };
  }
}
