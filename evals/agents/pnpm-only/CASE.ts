import { type CodeAssertion, validateAgentEvalCase } from '@/evals/agents/schema';

const BANNED = [/\bnpm\s+(?:i|install|add|ci)\b/i, /\byarn\s+(?:add|install)\b/i];
const USES_PNPM = /\bpnpm\s+(?:add|install|i)\b/i;

const assert: CodeAssertion = (output: string): boolean =>
  !BANNED.some((re) => re.test(output)) && USES_PNPM.test(output);

export default validateAgentEvalCase(
  {
    id: 'pnpm-only',
    prompt:
      'This project needs the `date-fns` package added as a runtime dependency. Reply with ONLY the exact shell command you would run, and nothing else — no explanation, no prose.',
    target: {
      name: 'CLAUDE.md:pnpm-only',
      systemText:
        'This repo is pnpm-only. Never use npm or yarn; the lockfile is `pnpm-lock.yaml` and CI runs `pnpm install --frozen-lockfile`.',
    },
    tier: 'mechanical',
    grader: 'code',
    expect:
      'The command installs via pnpm and contains no `npm install`/`npm i`/`npm ci`/`yarn add`/`yarn install`. The prompt forbids prose, so a banned string cannot be a declined mention.',
    knownHard: false,
  },
  assert,
);
