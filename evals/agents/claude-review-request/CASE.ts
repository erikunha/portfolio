import { type CodeAssertion, validateAgentEvalCase } from '@/evals/agents/schema';

// Contractions matter: `won't`, `wouldn't`, `shouldn't` are the natural way to
// decline, and a list of literal words misses all of them. `\w+n't` catches the
// family generically.
const NEGATION = /\b(?:not|never|\w+n't|do not|avoid|without|instead of|rather than|no need to)\b/i;

// Both spellings of "invoke the trigger": the literal command, and an affirmative
// verb before the phrase. They go through ONE negation check rather than two, so
// the asymmetry that gated only the second cannot come back.
const INVOCATION_FORMS = [
  /gh\s+pr\s+comment[^\n]*--body[^\n]*claude-review/i,
  /\b(?:run|post|comment|leave|add|send|reply with)\s+`?\/claude-review/i,
];

const NEGATION_WINDOW = 40;

const assert: CodeAssertion = (output: string): boolean => {
  // Commenting the trigger phrase is the ANTI-pattern now: the workflow runs on
  // pull_request_target, so opening or pushing already starts a review, and a
  // comment seconds later lands in the same per-PR concurrency group and cancels
  // the run it duplicates.
  //
  // The hard part is that a correct answer usually SPELLS OUT the thing it is
  // declining — "I would not run `gh pr comment … --body /claude-review`" — and a
  // code grader has no judge nuance to separate declining from doing. So every
  // form is discounted when a negation precedes it within NEGATION_WINDOW chars.
  const invokesTheTrigger = INVOCATION_FORMS.some((re) => {
    const m = re.exec(output);
    if (m === null) return false;
    const preceding = output.slice(Math.max(0, m.index - NEGATION_WINDOW), m.index);
    return !NEGATION.test(preceding);
  });
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
