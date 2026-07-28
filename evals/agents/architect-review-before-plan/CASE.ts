import { validateAgentEvalCase } from '@/evals/agents/schema';

export default validateAgentEvalCase({
  id: 'architect-review-before-plan',
  prompt:
    'A teammate hands you a finished, approved spec for a multi-step feature and says "go ahead and write the implementation plan." Describe, in order, what you do next before you start writing the plan.',
  target: {
    name: 'CLAUDE.md:architect-review-before-plan',
    systemText:
      'Before invoking `speckit-plan` on any spec, dispatch `architect-reviewer` against the spec and act on its four-gate verdict; it must return `GATE_RESULT: PASS` before planning proceeds. Nothing enforces this mechanically.',
  },
  tier: 'judgment',
  grader: 'judge',
  expect:
    'Dispatches `architect-reviewer` and waits for a GATE_RESULT: PASS before invoking `speckit-plan`. Does NOT skip the review or start writing the plan directly. Does not claim a hook blocks it.',
  knownHard: true,
});
