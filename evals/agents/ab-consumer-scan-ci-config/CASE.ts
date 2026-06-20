// evals/agents/ab-consumer-scan-ci-config/CASE.ts
//
// A/B case, CODE grader. Target: the CLAUDE.md consumer-scan rule (added 2026-06-20,
// PR #152) requiring a file move OR extraction to scan BOTH the code callers AND the
// gate/CI/config surface (`.github/workflows` path-filters, `.husky`, scripts,
// allowlists) for references to the moved path. The control arm carries the full
// rule; the treatment arm prunes the "(2) CI/config surface" clause, leaving only
// the code-caller scan. The --ab runner measures the success-rate delta: if the
// CI/config clause is load-bearing, the treatment stops emitting the
// scan-the-workflow-path-filters step that the control produces, yielding a negative
// delta. This is the exact failure class that leaked the `lib/eval/` ai-filter gap
// (a judge extraction left ci.yml's detect-changes pathspec pointing at the old
// home, so the calibration gate silently skipped).
//
// Judgment tier: the model must reason about WHERE a moved symbol is still referenced,
// not emit a fixed string. The base `target.systemText` mirrors the control so a
// single-arm (non --ab) run still exercises the full rule.

import { type CodeAssertion, validateAgentEvalCase } from '@/evals/agents/schema';

// PASS iff the plan references scanning the CI/config/gate surface (the distinctive
// thing the rule adds beyond a plain code-caller grep): GitHub workflows, the
// detect-changes path-filter, husky hooks, or a pathspec/allowlist. A code-callers-only
// answer (the treatment's expected behavior) does NOT mention these and FAILS.
const assert: CodeAssertion = (output: string): boolean =>
  /\.github\/workflows|detect-changes|path-?filter|\bci\.yml\b|\.husky|pathspec|allowlist|workflow file/i.test(
    output,
  );

// Control: the full consumer-scan rule, including the CI/config surface clause.
const CONTROL_SYSTEM_TEXT =
  'Before writing plan tasks for any file move OR extraction (relocating code or a symbol ' +
  'into a new module or path), grep for every reference to the old path or symbol across TWO ' +
  'surfaces: (1) code callers (grep the .ts/.tsx imports); AND (2) the gate/CI/config surface ' +
  'that hard-codes paths: .github/workflows path-filters (detect-changes especially), .husky ' +
  'hooks, scripts, and any allowlist or pathspec. A CI path-filter left pointing at the old ' +
  'location fails open silently (the gate evaluates to unchanged, skips, and a regression ships ' +
  'unguarded). Include a path-update task for every match including config and test files.';

// Treatment: the SAME rule with the "(2) CI/config surface" clause PRUNED. It still
// asks to scan code callers, but no longer names the workflow/path-filter/config
// surface (the variable under test for whether that clause is load-bearing).
const TREATMENT_SYSTEM_TEXT =
  'Before writing plan tasks for any file move OR extraction, grep for every reference to the ' +
  'old path or symbol among the code callers (grep the .ts/.tsx imports). Include a path-update ' +
  'task for every match including test files.';

export default validateAgentEvalCase(
  {
    id: 'ab-consumer-scan-ci-config',
    prompt:
      'You are about to extract the judge() function and the JUDGE_SYSTEM constant out of ' +
      'scripts/ask-eval.ts into a new module lib/eval/judge.ts, and import them back. Before ' +
      'you write the implementation plan, list the consumer-scan steps you would run to make ' +
      'sure nothing is left pointing at the old location after the move.',
    target: {
      name: 'CLAUDE.md:consumer-scan-ci-config',
      systemText: CONTROL_SYSTEM_TEXT,
    },
    tier: 'judgment',
    grader: 'code',
    expect:
      'The consumer-scan steps include scanning the CI/config surface (.github/workflows ' +
      'path-filters such as detect-changes, gates, allowlists/pathspecs) for the old path, not ' +
      'just code callers.',
    knownHard: false,
    control: { systemText: CONTROL_SYSTEM_TEXT },
    treatment: { systemText: TREATMENT_SYSTEM_TEXT },
  },
  assert,
);
