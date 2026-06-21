// Type declarations for the .mjs supply-chain age gate (allowJs is false in
// tsconfig, so the .mjs has no inferred types). Keeps the unit test fully
// typechecked without converting the script to TypeScript (it stays plain node
// so CI runs it without a build step). Mirrors scripts/check-semgrep-fixture.d.mts.
export type PkgEntry = { name: string; version: string };

export function parseLockfilePackages(lockfileContent: string): Map<string, PkgEntry>;
