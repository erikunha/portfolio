export function canonicalJSON(value: unknown): string;

export interface ChangeSignals {
  aiChanged: boolean;
  appChanged: boolean;
  uiChanged: boolean;
  pkgRenderChanged: boolean;
}
export interface Categories {
  ai: boolean;
  app: boolean;
  ui: boolean;
}
export function computeCategories(signals: ChangeSignals): Categories;
