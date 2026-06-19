// evals/agents/schema.ts
//
// The agent/prompt-eval corpus case schema. This corpus is DISTINCT from the
// /api/ask product corpus (content/ask-eval-corpus.ts): it evals the PLATFORM's
// own prompts/rules/agents, not the product. Each case is a directory
// evals/agents/<id>/ holding CASE.ts (default-exporting the validated case) and
// PROMPT.md (the human-readable task).
//
// A case models: the task `prompt`, the `target` (which platform prompt/rule is
// under test — a name descriptor + the system text), a `tier` (mechanical →
// haiku, judgment → sonnet), a `grader` (code → a free deterministic assertion;
// judge → the shared LLM judge), the `expect` criterion, and a `knownHard` flag
// (a deliberately-hard / known-failing case so the eval does not saturate at
// 100% and stop discriminating).

import { z } from 'zod';

// One A/B arm: a system-text variant of the rule under test. Two of these (a
// `control` and a `treatment`) turn a base case into an A/B case. The treatment
// is typically the control with a specific rule pruned, so the --ab runner can
// measure whether that rule is load-bearing.
const AbVariantSchema = z.object({
  systemText: z.string().min(1), // the prompt/rule variant under test for this arm
});

export const AgentEvalCaseSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1), // the task given to the target prompt
  target: z.object({
    name: z.string().min(1), // e.g. 'CLAUDE.md:no-broad-git-add'
    systemText: z.string().min(1), // the prompt/rule under test
  }),
  tier: z.enum(['mechanical', 'judgment']),
  grader: z.enum(['code', 'judge']),
  expect: z.string().min(1), // judge criterion OR assertion description
  knownHard: z.boolean().default(false), // deliberately-hard / known-failing
  // Optional A/B arms. A case declaring BOTH is eligible for --ab mode; a base
  // (single-arm) case omits them and runs only the default Monte-Carlo path.
  control: AbVariantSchema.optional(),
  treatment: AbVariantSchema.optional(),
});
export type AgentEvalCase = z.infer<typeof AgentEvalCaseSchema>;

// Code-grader assertion lives next to the case (not serializable into Zod): a
// pure predicate over the target's output string.
export type CodeAssertion = (output: string) => boolean;

// A validated case plus its (code-grader-only) assertion. The runner consumes
// this shape; the bare schema alone cannot encode the code↔assert pairing.
export type ValidatedAgentEvalCase = AgentEvalCase & { assert?: CodeAssertion };

/**
 * Parses a raw case against the Zod schema AND enforces the invariant the
 * schema cannot: a `grader: 'code'` case MUST supply an `assert` predicate
 * (the deterministic grader), and a `grader: 'judge'` case must not need one.
 * A code case without an assert is a config error — the runner would otherwise
 * have nothing to grade with for the free deterministic path.
 */
export function validateAgentEvalCase(
  raw: unknown,
  assert?: CodeAssertion,
): ValidatedAgentEvalCase {
  const parsed = AgentEvalCaseSchema.parse(raw);
  if (parsed.grader === 'code' && typeof assert !== 'function') {
    throw new Error(
      `case "${parsed.id}": a code grader requires an \`assert\` predicate, none supplied`,
    );
  }
  return assert ? { ...parsed, assert } : parsed;
}

// A case guaranteed to carry both A/B arms: the narrowed shape the --ab runner
// consumes. selectAbCases() produces these so the runner never reads an
// undefined arm.
export type AbCase<T extends AgentEvalCase = AgentEvalCase> = T & {
  control: { systemText: string };
  treatment: { systemText: string };
};

/**
 * Filters a corpus down to only the cases declaring BOTH a `control` and a
 * `treatment` arm. A case missing either arm is excluded from --ab mode rather
 * than run single-armed, so the A/B delta is always computed over a real
 * control-vs-treatment pair. The return type narrows so callers can read both
 * arms without an undefined check.
 */
export function selectAbCases<T extends AgentEvalCase>(cases: T[]): Array<AbCase<T>> {
  return cases.filter((c): c is AbCase<T> => c.control !== undefined && c.treatment !== undefined);
}
