export declare const NO_LEAKS: number;
export declare const LEAKS_FOUND: number;
export declare const MISSING_BINARY: string;
export declare const SECRET_STAGED: string;

export interface StagedRun {
  error?: Error;
  status: number | null;
}

export interface StagedVerdict {
  block: boolean;
  reason?: string;
}

export declare function decideStagedExit(res: StagedRun): StagedVerdict;
