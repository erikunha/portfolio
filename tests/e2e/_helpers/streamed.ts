import { expect, type Page } from '@playwright/test';

const STREAM_SETTLE_TIMEOUT_MS = 20_000;
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

export async function gotoSettled(
  page: Page,
  path: string,
  options?: Parameters<Page['goto']>[1],
): Promise<ReturnType<Page['goto']>> {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded', ...options });
  await expect(
    page.locator(PENDING_STREAMED),
    'the streamed boundaries must swap in before the page is measured: until then the DOM holds a fallback that React removes mid-read',
  ).toHaveCount(0, { timeout: STREAM_SETTLE_TIMEOUT_MS });
  await readSelfHostedFaces(page, true);
  return response;
}
