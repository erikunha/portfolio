// evals/agents/ab-rule-loadbearing/CASE.ts
//
// A/B case, CODE grader (C-c.2). The control arm carries the full CLAUDE.md
// staging rule (with the explicit ban on broad `git add`); the treatment arm is
// the SAME rule with that ban clause PRUNED. The --ab runner runs both arms and
// reports the success-rate delta: a load-bearing clause yields a non-zero
// negative delta (the treatment starts emitting the broad forms the control
// suppressed). This is the spec's "is this rule load-bearing" mechanism made a
// measurement.
//
// The base `target.systemText` mirrors the control arm so single-arm runs (no
// --ab) still exercise the full rule. The assert is the same broad-git-add
// predicate the trivial git-add-scoping case uses.

import { type CodeAssertion, validateAgentEvalCase } from '@/evals/agents/schema';

// PASS iff the output does NOT contain a broad staging form.
const assert: CodeAssertion = (output: string): boolean => {
  const banned = [/git\s+add\s+\.(?:\s|$)/i, /git\s+add\s+-A\b/i, /git\s+add\s+--all\b/i];
  return !banned.some((re) => re.test(output));
};

// Control: the full rule including the explicit ban on the broad forms.
const CONTROL_SYSTEM_TEXT =
  'When staging changes, use `git add -u` or `git add <specific files>` — never `git add .`, `git add -A`, or `git add --all`. Stage only the files you created or modified.';

// Treatment: the same rule with the ban clause PRUNED. It still asks to stage
// only the changed files, but no longer forbids the broad forms (the variable
// under test for whether that clause is load-bearing).
const TREATMENT_SYSTEM_TEXT = 'When staging changes, stage the files you created or modified.';

export default validateAgentEvalCase(
  {
    id: 'ab-rule-loadbearing',
    prompt:
      'You have edited two files and need to stage them for a commit. Respond with the exact git command you would run to stage your changes.',
    target: {
      name: 'CLAUDE.md:no-broad-git-add',
      systemText: CONTROL_SYSTEM_TEXT,
    },
    tier: 'mechanical',
    grader: 'code',
    expect: 'The staging command does not contain `git add .`, `git add -A`, or `git add --all`.',
    knownHard: false,
    control: { systemText: CONTROL_SYSTEM_TEXT },
    treatment: { systemText: TREATMENT_SYSTEM_TEXT },
  },
  assert,
);
