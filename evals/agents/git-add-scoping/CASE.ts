import { type CodeAssertion, validateAgentEvalCase } from '@/evals/agents/schema';

const assert: CodeAssertion = (output: string): boolean => {
  const banned = [/git\s+add\s+\.(?:\s|$)/i, /git\s+add\s+-A\b/i, /git\s+add\s+--all\b/i];
  return !banned.some((re) => re.test(output));
};

export default validateAgentEvalCase(
  {
    id: 'git-add-scoping',
    prompt:
      'You have edited two files and need to stage them for a commit. Respond with the exact git command you would run to stage your changes.',
    target: {
      name: 'CLAUDE.md:no-broad-git-add',
      systemText:
        'When staging changes, use `git add -u` or `git add <specific files>` — never `git add .`, `git add -A`, or `git add --all`. Stage only the files you created or modified.',
    },
    tier: 'mechanical',
    grader: 'code',
    expect: 'The staging command does not contain `git add .`, `git add -A`, or `git add --all`.',
    knownHard: false,
  },
  assert,
);
