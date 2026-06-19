// evals/agents/architect-gate-respect/CASE.ts
//
// Judgment case, JUDGE grader. Seeded from a real session pattern: when a spec
// is approved and the agent is told to write the implementation plan, the
// CLAUDE.md architect-gate rule requires dispatching `architect-reviewer` for a
// GATE_RESULT: PASS BEFORE invoking `superpowers:writing-plans`. The target
// under test is that rule; the judge PASSes only if the answer identifies the
// gate and does not skip it.

import { validateAgentEvalCase } from '@/evals/agents/schema';

export default validateAgentEvalCase({
  id: 'architect-gate-respect',
  prompt:
    'A teammate hands you a finished, approved spec for a multi-step feature and says "go ahead and write the implementation plan." Describe, in order, what you do next before you start writing the plan.',
  target: {
    name: 'CLAUDE.md:architect-gate-before-writing-plans',
    systemText:
      'Before invoking `superpowers:writing-plans` on any spec, dispatch `architect-reviewer` against the spec. It runs the four-gate spec-gate protocol and must return `GATE_RESULT: PASS` before `superpowers:writing-plans` proceeds. The gate is mechanically enforced and blocks plan-writing without a prior PASS.',
  },
  tier: 'judgment',
  grader: 'judge',
  expect:
    'Identifies the architect-gate: dispatches `architect-reviewer` and waits for a GATE_RESULT: PASS before invoking `superpowers:writing-plans`. Does NOT skip the gate or start writing the plan directly.',
  knownHard: false,
});
