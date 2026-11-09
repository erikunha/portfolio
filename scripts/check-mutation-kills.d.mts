export interface MutationReportMutant {
  status: string;
  coveredBy?: string[];
  testsCompleted?: number;
}

export interface MutationReport {
  files?: Record<string, { mutants?: MutationReportMutant[] }>;
}

export interface Assessment {
  ok: boolean;
  reason: string;
}

export interface CanaryResult {
  code: 0 | 1 | 2;
  message: string;
}

export interface MainOptions {
  log?: (message: string) => void;
  err?: (message: string) => void;
}

export function assessReport(report: MutationReport): Assessment;
export function runCanary(): CanaryResult;
export function main(argv: string[], options?: MainOptions): number;
