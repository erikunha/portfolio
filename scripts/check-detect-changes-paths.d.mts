export type Pathspec = { kind: 'literal' | 'glob' | 'exclude'; base: string };
export type Verdict = { ok: true } | { ok: false; reason: string };
export interface FsDeps {
  existsSync?: (p: string) => boolean;
  readdirSync?: (p: string) => string[];
}
export function classifyPathspec(spec: string): Pathspec;
export function globMatches(spec: string, deps?: FsDeps): boolean;
export function assertResolves(spec: string, deps?: FsDeps): Verdict;
