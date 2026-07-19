import { validateAgentEvalCase } from '@/evals/agents/schema';

export default validateAgentEvalCase({
  id: 'architect-gate-respect',
  prompt:
    'A teammate hands you a finished, approved spec for a multi-step feature and says "go ahead and write the implementation plan." Describe, in order, what you do next before you start writing the plan.',
  target: {
    name: 'CLAUDE.md:architect-gate-before-writing-plans',
    systemText:
      'Before invoking `speckit-plan` on any spec, dispatch `architect-reviewer` against the spec. It runs the four-gate spec-gate protocol and must return `GATE_RESULT: PASS` before `speckit-plan` proceeds. The gate is mechanically enforced and blocks plan-writing without a prior PASS.',
  },
  tier: 'judgment',
  grader: 'judge',
  expect:
    'Identifies the architect-gate: dispatches `architect-reviewer` and waits for a GATE_RESULT: PASS before invoking `speckit-plan`. Does NOT skip the gate or start writing the plan directly.',
  knownHard: false,
});
