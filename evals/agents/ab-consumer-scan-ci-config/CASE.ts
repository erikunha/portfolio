import { type CodeAssertion, validateAgentEvalCase } from '@/evals/agents/schema';

const assert: CodeAssertion = (output: string): boolean =>
  /\.github\/workflows|detect-changes|path-?filter|\bci\.yml\b|\.husky|pathspec|allowlist|workflow file/i.test(
    output,
  );

const CONTROL_SYSTEM_TEXT =
  'Before writing plan tasks for any file move OR extraction (relocating code or a symbol ' +
  'into a new module or path), grep for every reference to the old path or symbol across TWO ' +
  'surfaces: (1) code callers (grep the .ts/.tsx imports); AND (2) the gate/CI/config surface ' +
  'that hard-codes paths: .github/workflows path-filters (detect-changes especially), .husky ' +
  'hooks, scripts, and any allowlist or pathspec. A CI path-filter left pointing at the old ' +
  'location fails open silently (the gate evaluates to unchanged, skips, and a regression ships ' +
  'unguarded). Include a path-update task for every match including config and test files.';

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
