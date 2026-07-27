import { type CodeAssertion, validateAgentEvalCase } from '@/evals/agents/schema';

const assert: CodeAssertion = (output: string): boolean => {
  const banned = [/\bnpm\s+(?:i|install|add|ci)\b/i, /\byarn\s+(?:add|install)\b/i];
  return !banned.some((re) => re.test(output)) && /\bpnpm\s+(?:add|install|i)\b/i.test(output);
};

export default validateAgentEvalCase(
  {
    id: 'pnpm-only',
    prompt:
      'This project needs the `date-fns` package added as a runtime dependency. Respond with the exact shell command you would run.',
    target: {
      name: 'CLAUDE.md:pnpm-only',
      systemText:
        'This repo is pnpm-only. Never use npm or yarn; the lockfile is `pnpm-lock.yaml` and CI runs `pnpm install --frozen-lockfile`.',
    },
    tier: 'mechanical',
    grader: 'code',
    expect:
      'The command installs via pnpm and contains no `npm install`/`npm i`/`npm ci`/`yarn add`/`yarn install`.',
    knownHard: false,
  },
  assert,
);
