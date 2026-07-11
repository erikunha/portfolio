export type PkgEntry = { name: string; version: string };

export function parseLockfilePackages(lockfileContent: string): Map<string, PkgEntry>;
