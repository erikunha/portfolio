// evals/agents/load.ts
//
// Agent-eval corpus loader. Discovers every evals/agents/<id>/CASE.ts, validates
// each default export against AgentEvalCaseSchema, and returns the array — each
// entry carrying its source `dir` and (for code graders) its `assert`. Pure: no
// I/O beyond a directory read + dynamic import of the case modules.

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AgentEvalCaseSchema,
  type CodeAssertion,
  type ValidatedAgentEvalCase,
} from '@/evals/agents/schema';

export type LoadedCase = ValidatedAgentEvalCase & { dir: string };

// The evals/agents directory — resolved relative to this module so the loader
// works regardless of the process cwd.
const AGENTS_DIR = path.dirname(fileURLToPath(import.meta.url));

export async function loadCases(): Promise<LoadedCase[]> {
  // Each case is a subdirectory holding a CASE.ts; skip the __tests__ dir and
  // any non-directory entry.
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
    // Re-validate the serializable fields; the assert (if any) rides on the
    // default export untouched, since it is not part of the Zod shape.
    const parsed = AgentEvalCaseSchema.parse(raw);
    const assert = (raw as { assert?: CodeAssertion }).assert;
    loaded.push(assert ? { ...parsed, assert, dir: name } : { ...parsed, dir: name });
  }
  return loaded;
}
