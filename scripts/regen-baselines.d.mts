export const DEFAULT_UPDATE_MODE: 'changed';
export const VISUAL_SPEC: string;

export interface RegenPlanInput {
  mode?: string | undefined;
  grep?: string | undefined;
  baseUrl?: string | undefined;
  baseEnv?: Record<string, string | undefined> | undefined;
}

export interface RegenPlan {
  command: string;
  args: string[];
  env: Record<string, string | undefined>;
}

export function buildRegenPlan(input: RegenPlanInput): RegenPlan;
export function listChangedBaselines(porcelainOutput: string): string[];
