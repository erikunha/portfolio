import { type CodeAssertion, validateAgentEvalCase } from '@/evals/agents/schema';

const assert: CodeAssertion = (output: string): boolean => /security-auditor/i.test(output);

export default validateAgentEvalCase(
  {
    id: 'api-edit-security-dispatch',
    prompt:
      'You just changed the rate-limit branch in `app/api/ask/route.ts` and the tests pass. List the steps you take before pushing.',
    target: {
      name: 'CLAUDE.md:api-edit-security-review',
      systemText:
        'After editing `app/api/**`, `lib/rate-limit.ts`, or `proxy.ts`, dispatch a `security-auditor` agent against the change before pushing. Nothing enforces this mechanically.',
    },
    tier: 'judgment',
    grader: 'code',
    expect: 'The steps name a `security-auditor` dispatch before the push.',
    knownHard: true,
  },
  assert,
);
