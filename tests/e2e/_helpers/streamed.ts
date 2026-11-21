import { errors, expect, type Page, type Request, type Response } from '@playwright/test';

const STREAM_SETTLE_TIMEOUT_MS = 20_000;
const NAVIGATION_TIMEOUT_MS = 12_000;
const PENDING_REQUESTS_SHOWN = 25;
const NO_PENDING_REQUESTS = 'none';
const NO_RESPONSE = 'no response';
export const PENDING_STREAMED = [
  'template[id^="B:"]',
  '[hidden][id^="S:"]',
  '#sec-live-metrics [aria-busy="true"]',
  '#sec-live-perf [aria-busy="true"]',
  '[data-col$="-loading"]',
].join(', ');

const FONT_FACES_FAILED = 'the declared font faces must load before the page is measured';

async function readSelfHostedFaces(page: Page, wait: boolean): Promise<string[]> {
  return page.evaluate(
    async ([shouldWait, timeoutMs, message]) => {
      const families = new Set<string>();
      const rulesOf = (sheet: CSSStyleSheet | CSSGroupingRule): CSSRule[] => {
        try {
          return [...sheet.cssRules];
        } catch {
          return [];
        }
      };
      const collect = (rules: CSSRule[]) => {
        for (const rule of rules) {
          if (rule instanceof CSSFontFaceRule) {
            if (rule.style.getPropertyValue('src').includes('url(')) {
              families.add(rule.style.getPropertyValue('font-family').replace(/^["']|["']$/g, ''));
            }
          } else if (rule instanceof CSSGroupingRule) {
            collect(rulesOf(rule));
          }
        }
      };
      for (const sheet of document.styleSheets) collect(rulesOf(sheet));
      const faces = [...document.fonts].filter((face) => families.has(face.family));
      if (shouldWait) {
        await Promise.race([
          Promise.allSettled(faces.map((face) => face.load())),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(message)), timeoutMs),
          ),
        ]);
      }
      return faces.map((face) => face.status);
    },
    [wait, STREAM_SETTLE_TIMEOUT_MS, FONT_FACES_FAILED] as const,
  );
}

export function selfHostedFaceStatuses(page: Page): Promise<string[]> {
  return readSelfHostedFaces(page, false);
}

function pendingRequestLabel(request: Request, status: number | undefined): string {
  const answer = status === undefined ? NO_RESPONSE : `status ${status}`;
  return `${new URL(request.url()).pathname} (${request.resourceType()}, ${answer})`;
}

function describeStalledNavigation(
  path: string,
  timeoutMs: number,
  pending: ReadonlySet<Request>,
  statuses: ReadonlyMap<Request, number>,
): string {
  const labels = [...pending].map((request) => pendingRequestLabel(request, statuses.get(request)));
  const shown = labels.slice(0, PENDING_REQUESTS_SHOWN);
  const hidden = labels.length - shown.length;
  const list = shown.length === 0 ? NO_PENDING_REQUESTS : shown.join(', ');
  const more = hidden > 0 ? `, and ${hidden} more` : '';
  return `navigation to ${path} did not reach domcontentloaded within ${timeoutMs} ms; requests started and never finished: ${list}${more}`;
}

async function navigateWithRequestLog(
  page: Page,
  path: string,
  options: Parameters<Page['goto']>[1],
): Promise<ReturnType<Page['goto']>> {
  const timeout = options?.timeout ?? NAVIGATION_TIMEOUT_MS;
  const pending = new Set<Request>();
  const statuses = new Map<Request, number>();
  const track = (request: Request) => pending.add(request);
  const answer = (response: Response) => statuses.set(response.request(), response.status());
  const settle = (request: Request) => pending.delete(request);
  page.on('request', track);
  page.on('response', answer);
  page.on('requestfinished', settle);
  page.on('requestfailed', settle);
  try {
    return await page.goto(path, { waitUntil: 'domcontentloaded', ...options, timeout });
  } catch (error) {
    if (error instanceof errors.TimeoutError) {
      throw new Error(describeStalledNavigation(path, timeout, pending, statuses), {
        cause: error,
      });
    }
    throw error;
  } finally {
    page.off('request', track);
    page.off('response', answer);
    page.off('requestfinished', settle);
    page.off('requestfailed', settle);
  }
}

export async function gotoSettled(
  page: Page,
  path: string,
  options?: Parameters<Page['goto']>[1],
): Promise<ReturnType<Page['goto']>> {
  const response = await navigateWithRequestLog(page, path, options);
  await expect(
    page.locator(PENDING_STREAMED),
    'the streamed boundaries must swap in before the page is measured: until then the DOM holds a fallback that React removes mid-read',
  ).toHaveCount(0, { timeout: STREAM_SETTLE_TIMEOUT_MS });
  await readSelfHostedFaces(page, true);
  return response;
}
