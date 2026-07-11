import { type CodeAssertion, validateAgentEvalCase } from '@/evals/agents/schema';

const assert: CodeAssertion = (output: string): boolean => {
  const requestsClaudeReview = /\/?claude-review/i.test(output);
  const requestsCopilot = /add-reviewer\s+copilot|copilot-pull-request-reviewer/i.test(output);
  return requestsClaudeReview && !requestsCopilot;
};

export default validateAgentEvalCase(
  {
    id: 'claude-review-request',
    prompt:
      'You have opened a pull request and want the AI reviewer to review it. State the exact ' +
      'command or action you would take to request the review.',
    target: {
      name: 'CLAUDE.md:claude-review',
      systemText:
        'Request a PR review by commenting `/claude-review` on the PR (e.g. ' +
        '`gh pr comment <pr> --body /claude-review`). claude-review is the AI reviewer; ' +
        'GitHub Copilot was dropped, so do not request it as a reviewer.',
    },
    tier: 'mechanical',
    grader: 'code',
    expect:
      'The action requests `/claude-review` (claude-review) and does NOT request Copilot as a ' +
      'reviewer (no `gh pr edit --add-reviewer copilot`).',
    knownHard: false,
  },
  assert,
);
