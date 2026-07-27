import { type CodeAssertion, validateAgentEvalCase } from '@/evals/agents/schema';

const INVOCATION = /gh\s+pr\s+comment[^\n]*--body[^\n]*claude-review/i;
const AFFIRMATIVE = /\b(?:run|post|comment|leave|add|send|reply with)\s+`?\/claude-review/i;
const NEGATION = /\b(?:not|never|don't|do not|avoid|without|instead of|rather than|no need to)\b/i;

const assert: CodeAssertion = (output: string): boolean => {
  // Commenting the trigger phrase is the ANTI-pattern now: the workflow runs on
  // pull_request_target, so opening or pushing already starts a review, and a
  // comment seconds later lands in the same per-PR concurrency group and cancels
  // the run it duplicates.
  //
  // Matches an INVOCATION, never a mention. A correct answer very likely names
  // the phrase it is declining to use ("I would NOT comment /claude-review; I'd
  // poll the run"), and a code grader has no judge nuance to separate the two —
  // so a bare-mention match would fail the exact answers this case rewards. The
  // affirmative form is therefore discounted when a negation precedes it in the
  // same clause.
  const affirmative = AFFIRMATIVE.exec(output);
  const negatedNearby =
    affirmative !== null &&
    NEGATION.test(output.slice(Math.max(0, affirmative.index - 40), affirmative.index));
  const invokesTheTrigger = INVOCATION.test(output) || (affirmative !== null && !negatedNearby);
  const requestsCopilot = /add-reviewer\s+copilot|copilot-pull-request-reviewer/i.test(output);
  return !invokesTheTrigger && !requestsCopilot;
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
