// Type declarations for the .mjs self-test helper (allowJs is false in
// tsconfig, so the .mjs has no inferred types). Keeps the unit test fully
// typechecked without converting the script to TypeScript (it stays plain
// node so the CI semgrep job can run it without pnpm install). Mirrors
// scripts/lib/transcript.d.mts.
export const EXPECTED_RULES: readonly string[];

export type SemgrepResult = { path?: string; check_id?: string };
export type Verdict = { ok: true } | { ok: false; reason: string };

export function assertExpectedFindings(results: SemgrepResult[]): Verdict;
