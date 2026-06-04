// Type declarations for the .mjs transcript helper (allowJs is false in
// tsconfig, so the .mjs has no inferred types). Keeps review-stamp.ts and the
// unit tests fully typechecked without converting the helper to TypeScript
// (the spec mandates scripts/lib/transcript.mjs).

export type TranscriptRecord = Record<string, unknown>;

export function readTranscript(transcriptPath: string): TranscriptRecord[];

export function lastUserCommitMarker(records: TranscriptRecord[]): number;

export function agentsDispatchedSince(records: TranscriptRecord[], boundaryIndex: number): string[];

export function containsSince(
  records: TranscriptRecord[],
  needle: string,
  boundaryIndex: number,
): boolean;
