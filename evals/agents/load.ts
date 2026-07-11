import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AgentEvalCaseSchema,
  type CodeAssertion,
  type ValidatedAgentEvalCase,
} from '@/evals/agents/schema';

export type LoadedCase = ValidatedAgentEvalCase & { dir: string };

const AGENTS_DIR = path.dirname(fileURLToPath(import.meta.url));

export async function loadCases(): Promise<LoadedCase[]> {
  const entries = readdirSync(AGENTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== '__tests__')
    .map((e) => e.name)
    .sort();

  const loaded: LoadedCase[] = [];
  for (const name of entries) {
    const mod = (await import(`@/evals/agents/${name}/CASE`)) as {
      default?: unknown;
    };
    const raw = mod.default;
    const parsed = AgentEvalCaseSchema.parse(raw);
    const assert = (raw as { assert?: CodeAssertion }).assert;
    loaded.push(assert ? { ...parsed, assert, dir: name } : { ...parsed, dir: name });
  }
  return loaded;
}
