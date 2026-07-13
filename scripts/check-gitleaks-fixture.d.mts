export declare const EXPECTED_RULES: string[];
export declare const LEAKY_FIXTURE: string;
export declare const CLEAN_FIXTURE: string;

export interface Verdict {
  ok: boolean;
  reason?: string;
}

export interface GitleaksRun {
  error?: Error;
  status: number | null;
  stderr?: string | Buffer | null;
}

export interface GitleaksFinding {
  File?: string;
  RuleID?: string;
}

export declare function interpretGitleaksRun(res: GitleaksRun): Verdict;
export declare function assertExpectedFindings(findings: GitleaksFinding[]): Verdict;
