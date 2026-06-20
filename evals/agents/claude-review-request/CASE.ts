// evals/agents/claude-review-request/CASE.ts
//
// Deterministic case, CODE grader. Target: the CLAUDE.md review-flow rule (set
// 2026-06-20, PR #155) that a PR review is requested via /claude-review, with
// GitHub Copilot dropped as the AI reviewer. PASS iff the output requests the
// claude-review and does NOT request Copilot as a reviewer (the old `gh pr edit
// --add-reviewer copilot-pull-request-reviewer` form). Mechanical tier: the
// expected action is a near-fixed command, so haiku should produce it given the rule.
//
// Note the assert bans the copilot-REQUEST forms, not any mention of "Copilot":
// a correct answer may say "claude-review, not Copilot" and must still pass.

import { type CodeAssertion, validateAgentEvalCase } from '@/evals/agents/schema';

const assert: CodeAssertion = (output: string): boolean => {
  const requestsClaudeReview = /\/?claude-review/i.test(output);
  // Ban only the concrete Copilot-REQUEST forms (the command + the bot handle), not
  // any mention of "Copilot". A correct answer may say "claude-review, not Copilot",
  // and matching loose prose like "request Copilot" would mis-flag "do not request
  // Copilot". The prompt asks for the exact command/action, so the command form is
  // the discriminating signal.
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
