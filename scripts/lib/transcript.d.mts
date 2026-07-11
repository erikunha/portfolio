export type TranscriptRecord = Record<string, unknown>;

export function readTranscript(transcriptPath: string): TranscriptRecord[];

export function lastUserCommitMarker(records: TranscriptRecord[]): number;

export function agentsDispatchedSince(records: TranscriptRecord[], boundaryIndex: number): string[];

export function lastDispatchIndex(records: TranscriptRecord[], subagentType: string): number;

export function containsSince(
  records: TranscriptRecord[],
  needle: string,
  boundaryIndex: number,
): boolean;

export function containsInToolResultSince(
  records: TranscriptRecord[],
  needle: string,
  boundaryIndex: number,
): boolean;

export function agentDispatchedAfter(
  records: TranscriptRecord[],
  subagentType: string,
  afterIso: string,
): boolean;

export type TaskOutput = { content: string; mtimeMs: number };

export type TaskOutputReader = (path: string) => TaskOutput | null;

export function agentResultContains(
  records: TranscriptRecord[],
  subagentType: string,
  needle: string,
  readTaskOutput?: TaskOutputReader,
  sessionId?: string,
): boolean;
