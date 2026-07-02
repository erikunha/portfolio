export function canonicalJSON(value: unknown): string;

export interface ChangeSignals {
  aiChanged: boolean;
  appChanged: boolean;
  uiChanged: boolean;
  pkgRenderChanged: boolean;
  /** Optional: the runner always supplies it; `undefined` is treated as `false`. */
  aiMajorChanged?: boolean;
}
export interface Categories {
  ai: boolean;
  app: boolean;
  ui: boolean;
}
export function computeCategories(signals: ChangeSignals): Categories;
export function aiMajor(pkgJsonString: string): number | null;
