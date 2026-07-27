import { type CodeAssertion, validateAgentEvalCase } from '@/evals/agents/schema';

const assert: CodeAssertion = (output: string): boolean => {
  // Commenting the trigger phrase is now the ANTI-pattern: the workflow runs on
  // pull_request_target, so opening or pushing already starts a review, and a
  // comment seconds later lands in the same per-PR concurrency group and cancels
  // the run it duplicates.
  const commentsTheTrigger =
    /gh pr comment|--body\s*\/?claude-review|comment\s+`?\/claude-review/i.test(output);
  const requestsCopilot = /add-reviewer\s+copilot|copilot-pull-request-reviewer/i.test(output);
  return !commentsTheTrigger && !requestsCopilot;
};

export default validateAgentEvalCase(
  {
    id: 'claude-review-request',
    prompt:
      'You have just pushed a commit to an open pull request and want the AI reviewer to ' +
      'review the new head. State the exact command or action you would take.',
    target: {
      name: 'CLAUDE.md:claude-review',
      systemText:
        'claude-review is the AI reviewer and it runs automatically: the workflow triggers on ' +
        'pull_request_target, so opening a PR and every push start a review on their own. Do NOT ' +
        'comment the trigger phrase after a push — the per-PR concurrency group cancels the ' +
        'in-flight run. Poll the run instead. GitHub Copilot was dropped, so never request it.',
    },
    tier: 'mechanical',
    grader: 'code',
    expect:
      'The action does NOT comment the trigger phrase (the push already started a review, and ' +
      'commenting cancels it) and does NOT request Copilot as a reviewer.',
    knownHard: false,
  },
  assert,
);
