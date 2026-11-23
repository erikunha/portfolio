export const WEBKIT_COOP_STALL_ANNOTATION = 'webkit-coop-navigation-stall';
export const STALL_PRONE_BROWSER = 'webkit';
export const NAVIGATION_STALL_WINDOW_MS = 5_000;
const BLANK_PAGE_URL = 'about:blank';
const STALL_WINDOW_ELAPSED = Symbol('stall window elapsed');

export interface DocumentRequestState {
  readonly url: string;
  readonly responded: boolean;
  readonly failed: boolean;
}

export interface NavigationStallObservation {
  readonly browserName: string | undefined;
  readonly targetUrl: string;
  readonly pageUrl: string;
  readonly documentRequest: DocumentRequestState | undefined;
  readonly recoveredBefore: boolean;
}

export interface StallRecovery<T> {
  readonly navigate: () => Promise<T>;
  readonly observe: () => NavigationStallObservation;
  readonly recordRecovery: () => void;
  readonly stallWindowMs: number;
}

function withoutFragment(url: URL): string {
  const copy = new URL(url);
  copy.hash = '';
  return copy.href;
}

export function isSameDocumentTarget(targetUrl: string, requestUrl: string): boolean {
  if (!URL.canParse(requestUrl)) return false;
  const request = new URL(requestUrl);
  if (!URL.canParse(targetUrl, request)) return false;
  return withoutFragment(new URL(targetUrl, request)) === withoutFragment(request);
}

export function isWebKitCoopNavigationStall(observation: NavigationStallObservation): boolean {
  const request = observation.documentRequest;
  return (
    observation.browserName === STALL_PRONE_BROWSER &&
    !observation.recoveredBefore &&
    observation.pageUrl === BLANK_PAGE_URL &&
    request !== undefined &&
    !request.responded &&
    !request.failed &&
    isSameDocumentTarget(observation.targetUrl, request.url)
  );
}

function stallWindow(ms: number): {
  elapsed: Promise<typeof STALL_WINDOW_ELAPSED>;
  cancel: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const elapsed = new Promise<typeof STALL_WINDOW_ELAPSED>((resolve) => {
    timer = setTimeout(() => resolve(STALL_WINDOW_ELAPSED), ms);
  });
  return { elapsed, cancel: () => clearTimeout(timer) };
}

export async function navigateWithStallRecovery<T>(recovery: StallRecovery<T>): Promise<T> {
  const first = recovery.navigate();
  const window = stallWindow(recovery.stallWindowMs);
  let outcome: T | typeof STALL_WINDOW_ELAPSED;
  try {
    outcome = await Promise.race([first, window.elapsed]);
  } finally {
    window.cancel();
  }
  if (outcome !== STALL_WINDOW_ELAPSED) return outcome;
  if (!isWebKitCoopNavigationStall(recovery.observe())) return first;
  recovery.recordRecovery();
  return recovery.navigate();
}
