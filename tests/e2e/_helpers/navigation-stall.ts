import type { Browser, BrowserContext, Page, Request, Response } from '@playwright/test';

export const WEBKIT_COOP_STALL_ANNOTATION = 'webkit-coop-navigation-stall';
export const STALL_PRONE_BROWSER = 'webkit';
export const HEALTHY_COOP_SWAP_GAP_MAX_MS = 4_976;
export const NAVIGATION_STALL_WINDOW_MS = 5_000;
export const VALIDATED_PLAYWRIGHT_VERSION = '1.65.1';
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
  readonly recoveryFirstByteMs: () => number | undefined;
  readonly targetUrl: string;
  readonly stallWindowMs: number;
}

export interface Annotation {
  type: string;
  description?: string;
}

export interface AnnotationSink {
  readonly annotations: Annotation[];
}

export interface StallGuardDependencies {
  readonly browserName: (page: Page) => string | undefined;
  readonly testInfo: () => AnnotationSink;
  readonly now: () => number;
}

export class SlowFirstByteError extends Error {
  constructor(url: string, firstByteMs: number, windowMs: number) {
    super(
      `slow first byte: after one WebKit COOP stall recovery, the document for ${url} answered ${firstByteMs} ms after the second navigation started, over the ${windowMs} ms stall window. A server or process swap this slow is not the WebKit COOP stall.`,
    );
    this.name = 'SlowFirstByteError';
  }
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
  const second = await recovery.navigate();
  const firstByteMs = recovery.recoveryFirstByteMs();
  if (firstByteMs !== undefined && firstByteMs > recovery.stallWindowMs) {
    throw new SlowFirstByteError(recovery.targetUrl, firstByteMs, recovery.stallWindowMs);
  }
  return second;
}

interface TrackedDocumentRequest {
  readonly request: Request;
  respondedAt: number | undefined;
  failed: boolean;
}

interface DocumentRequestWatch {
  readonly state: () => DocumentRequestState | undefined;
  readonly restart: () => void;
  readonly firstByteMs: () => number | undefined;
  readonly stop: () => void;
}

function watchDocumentRequest(page: Page, now: () => number): DocumentRequestWatch {
  let tracked: TrackedDocumentRequest | undefined;
  let startedAt = now();
  const onRequest = (request: Request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      tracked = { request, respondedAt: undefined, failed: false };
    }
  };
  const onResponse = (response: Response) => {
    if (tracked?.request === response.request()) tracked.respondedAt = now();
  };
  const onRequestFailed = (request: Request) => {
    if (tracked?.request === request) tracked.failed = true;
  };
  page.on('request', onRequest);
  page.on('response', onResponse);
  page.on('requestfailed', onRequestFailed);
  return {
    state: () =>
      tracked && {
        url: tracked.request.url(),
        responded: tracked.respondedAt !== undefined,
        failed: tracked.failed,
      },
    restart: () => {
      tracked = undefined;
      startedAt = now();
    },
    firstByteMs: () =>
      tracked?.respondedAt === undefined ? undefined : tracked.respondedAt - startedAt,
    stop: () => {
      page.off('request', onRequest);
      page.off('response', onResponse);
      page.off('requestfailed', onRequestFailed);
    },
  };
}

type Use<T> = (value: T) => Promise<void>;

export function createStallGuard(dependencies: StallGuardDependencies) {
  const guardedPages = new WeakSet<Page>();
  const guardedContexts = new WeakSet<BrowserContext>();
  const guardedBrowsers = new WeakSet<Browser>();

  const recoveredInThisTest = () =>
    dependencies
      .testInfo()
      .annotations.some((annotation) => annotation.type === WEBKIT_COOP_STALL_ANNOTATION);

  function guardNavigation(page: Page, knownBrowserName?: string): Page {
    if (guardedPages.has(page)) return page;
    guardedPages.add(page);
    const browserName = knownBrowserName ?? dependencies.browserName(page);
    if (browserName !== STALL_PRONE_BROWSER) return page;
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const startedAt = dependencies.now();
      const watch = watchDocumentRequest(page, dependencies.now);
      let recovery: Annotation | undefined;
      const noteOutcome = (outcome: string) => {
        if (recovery === undefined) return;
        recovery.description = `${recovery.description}; recovered: ${outcome}`;
      };
      try {
        const response = await navigateWithStallRecovery({
          navigate: () => goto(url, options),
          observe: () => {
            const cheap = {
              browserName,
              targetUrl: url,
              pageUrl: page.url(),
              documentRequest: watch.state(),
              recoveredBefore: false,
            };
            if (!isWebKitCoopNavigationStall(cheap)) return cheap;
            return { ...cheap, recoveredBefore: recoveredInThisTest() };
          },
          recordRecovery: () => {
            recovery = {
              type: WEBKIT_COOP_STALL_ANNOTATION,
              description: `${url}; first attempt stalled ${dependencies.now() - startedAt} ms`,
            };
            dependencies.testInfo().annotations.push(recovery);
            watch.restart();
          },
          recoveryFirstByteMs: watch.firstByteMs,
          targetUrl: url,
          stallWindowMs: NAVIGATION_STALL_WINDOW_MS,
        });
        noteOutcome(`status ${response?.status() ?? 'none'}`);
        return response;
      } catch (error) {
        noteOutcome(`failed, ${error instanceof Error ? error.name : 'error'}`);
        throw error;
      } finally {
        watch.stop();
      }
    };
    return page;
  }

  function guardContext(context: BrowserContext, browserType?: { name(): string }): BrowserContext {
    if (guardedContexts.has(context)) return context;
    guardedContexts.add(context);
    const browserName = browserType?.name();
    const guardPage = (page: Page) => guardNavigation(page, browserName);
    context.on('page', guardPage);
    for (const page of context.pages()) guardPage(page);
    return context;
  }

  function guardBrowser(browser: Browser): Browser {
    if (guardedBrowsers.has(browser)) return browser;
    guardedBrowsers.add(browser);
    const newContext = browser.newContext.bind(browser);
    const newPage = browser.newPage.bind(browser);
    browser.newContext = async (options) => guardContext(await newContext(options));
    browser.newPage = async (options) => guardNavigation(await newPage(options));
    return browser;
  }

  const guardWorkerBrowser = async ({ browser }: { browser: Browser }, use: Use<Browser>) =>
    use(guardBrowser(browser));
  const workerScope: { scope: 'worker' } = { scope: 'worker' };
  const fixtures = {
    browser: [guardWorkerBrowser, workerScope] as [typeof guardWorkerBrowser, typeof workerScope],
    context: async ({ context }: { context: BrowserContext }, use: Use<BrowserContext>) =>
      use(guardContext(context)),
    page: async ({ page }: { page: Page }, use: Use<Page>) => use(guardNavigation(page)),
  };

  return { guardNavigation, guardContext, guardBrowser, fixtures };
}
