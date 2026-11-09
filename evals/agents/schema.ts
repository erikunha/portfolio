import { z } from 'zod';

const AbVariantSchema = z.object({
  systemText: z.string().min(1),
});

export const AgentEvalCaseSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  target: z.object({
    name: z.string().min(1),
    systemText: z.string().min(1),
  }),
  tier: z.enum(['mechanical', 'judgment']),
  grader: z.enum(['code', 'judge']),
  expect: z.string().min(1),
  knownHard: z.boolean().default(false),
  control: AbVariantSchema.optional(),
  treatment: AbVariantSchema.optional(),
});
export type AgentEvalCase = z.infer<typeof AgentEvalCaseSchema>;

export type CodeAssertion = (output: string) => boolean;

export type ValidatedAgentEvalCase = AgentEvalCase & { assert?: CodeAssertion };

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

export type AbCase<T extends AgentEvalCase = AgentEvalCase> = T & {
  control: { systemText: string };
  treatment: { systemText: string };
};

export function selectAbCases<T extends AgentEvalCase>(cases: T[]): Array<AbCase<T>> {
  return cases.filter((c): c is AbCase<T> => c.control !== undefined && c.treatment !== undefined);
}
