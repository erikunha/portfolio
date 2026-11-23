import {
  type Browser,
  type BrowserContext,
  test as base,
  type Page,
  type Request,
  type Response,
} from '@playwright/test';
import {
  type DocumentRequestState,
  NAVIGATION_STALL_WINDOW_MS,
  navigateWithStallRecovery,
  STALL_PRONE_BROWSER,
  WEBKIT_COOP_STALL_ANNOTATION,
} from './navigation-stall';

export * from '@playwright/test';

interface DocumentRequestWatch {
  readonly state: () => DocumentRequestState | undefined;
  readonly stop: () => void;
}

interface TrackedDocumentRequest {
  readonly request: Request;
  responded: boolean;
  failed: boolean;
}

const guardedPages = new WeakSet<Page>();
const guardedContexts = new WeakSet<BrowserContext>();
const guardedBrowsers = new WeakSet<Browser>();

function watchDocumentRequest(page: Page): DocumentRequestWatch {
  let tracked: TrackedDocumentRequest | undefined;
  const onRequest = (request: Request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      tracked = { request, responded: false, failed: false };
    }
  };
  const onResponse = (response: Response) => {
    if (tracked?.request === response.request()) tracked.responded = true;
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
        responded: tracked.responded,
        failed: tracked.failed,
      },
    stop: () => {
      page.off('request', onRequest);
      page.off('response', onResponse);
      page.off('requestfailed', onRequestFailed);
    },
  };
}

function recoveredInThisTest(): boolean {
  return base
    .info()
    .annotations.some((annotation) => annotation.type === WEBKIT_COOP_STALL_ANNOTATION);
}

export function guardNavigation(page: Page): Page {
  if (guardedPages.has(page)) return page;
  guardedPages.add(page);
  const goto = page.goto.bind(page);
  page.goto = async (url, options) => {
    const browserName = page.context().browser()?.browserType().name();
    if (browserName !== STALL_PRONE_BROWSER) return goto(url, options);
    const watch = watchDocumentRequest(page);
    try {
      return await navigateWithStallRecovery({
        navigate: () => goto(url, options),
        observe: () => ({
          browserName,
          targetUrl: url,
          pageUrl: page.url(),
          documentRequest: watch.state(),
          recoveredBefore: recoveredInThisTest(),
        }),
        recordRecovery: () =>
          base.info().annotations.push({ type: WEBKIT_COOP_STALL_ANNOTATION, description: url }),
        stallWindowMs: NAVIGATION_STALL_WINDOW_MS,
      });
    } finally {
      watch.stop();
    }
  };
  return page;
}

export function guardContext(context: BrowserContext): BrowserContext {
  if (guardedContexts.has(context)) return context;
  guardedContexts.add(context);
  context.on('page', guardNavigation);
  for (const page of context.pages()) guardNavigation(page);
  return context;
}

export function guardBrowser(browser: Browser): Browser {
  if (guardedBrowsers.has(browser)) return browser;
  guardedBrowsers.add(browser);
  const newContext = browser.newContext.bind(browser);
  const newPage = browser.newPage.bind(browser);
  browser.newContext = async (options) => guardContext(await newContext(options));
  browser.newPage = async (options) => guardNavigation(await newPage(options));
  return browser;
}

export const test = base.extend({
  browser: [async ({ browser }, use) => use(guardBrowser(browser)), { scope: 'worker' }],
  context: async ({ context }, use) => use(guardContext(context)),
  page: async ({ page }, use) => use(guardNavigation(page)),
});
