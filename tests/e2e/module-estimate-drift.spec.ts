import { WIDTH } from './_helpers/geometry';
import { gotoSettled } from './_helpers/streamed';
import { expect, type Page, test } from './_helpers/test';

const LOCALES = [
  { name: 'en', path: '/' },
  { name: 'pt', path: '/pt' },
] as const;

const SWEEP_STEP_PX = 10;
const SWEEP_LAST_PX = 1300;
const EDGE_WIDTHS = [
  WIDTH.PHONE_SMALL - 1,
  WIDTH.PHONE_SMALL,
  WIDTH.PHONE_ANDROID - 1,
  WIDTH.PHONE_ANDROID,
  WIDTH.BELOW_PHONE_LARGE,
  WIDTH.PHONE_LARGE,
  WIDTH.PHONE_ANDROID_LARGE - 1,
  WIDTH.PHONE_ANDROID_LARGE,
  WIDTH.BELOW_PHONE_WIDE,
  WIDTH.PHONE_WIDE,
  WIDTH.TABLET_SMALL - 1,
  WIDTH.TABLET_SMALL,
  WIDTH.BELOW_TABLET,
  WIDTH.TABLET,
  WIDTH.LAPTOP_COMPACT - 1,
  WIDTH.LAPTOP_COMPACT,
  WIDTH.BELOW_LAPTOP,
  WIDTH.LAPTOP,
  WIDTH.DESKTOP - 1,
  WIDTH.DESKTOP,
  WIDTH.DESKTOP_WIDE,
  WIDTH.DESKTOP_FULL_HD,
];
const SWEEP_WIDTHS = [
  ...new Set([
    ...Array.from(
      { length: Math.floor((SWEEP_LAST_PX - WIDTH.PHONE_NARROW) / SWEEP_STEP_PX) + 1 },
      (_, step) => WIDTH.PHONE_NARROW + step * SWEEP_STEP_PX,
    ),
    ...EDGE_WIDTHS,
  ]),
].sort((a, b) => a - b);

const SWEEP_TESTS_PER_LOCALE = 8;
const WIDTHS_PER_TEST = Math.ceil(SWEEP_WIDTHS.length / SWEEP_TESTS_PER_LOCALE);
const SWEEP_SLICES = Array.from({ length: SWEEP_TESTS_PER_LOCALE }, (_, slice) =>
  SWEEP_WIDTHS.slice(slice * WIDTHS_PER_TEST, (slice + 1) * WIDTHS_PER_TEST),
);

const VIEWPORT_HEIGHT = 800;
const SUBPIXEL_TOLERANCE_PX = 1;
const PERCENT = 100;

/**
 * How much taller than its content a placeholder may be, per module. The two
 * list modules wrap their rows by locale and by engine: at one width the
 * Portuguese page is up to 17% taller than the English one, so no single
 * estimate can sit closer than that. Their limit is that floor plus 11 points
 * for the height a band loses across its own width range. Guitar and contact
 * vary 7% and 6% at one width; guitar also differs 12% to 16% between the
 * phone mixer and the desktop one at one width, so it gets 20% and contact 12%.
 */
const OVERSHOOT_LIMIT = {
  'sec-git-log': 0.28,
  'sec-hottest-takes': 0.28,
  'sec-guitar': 0.2,
  'sec-contact': 0.12,
} as const;

/**
 * The server picks the phone mixer from the user agent, so above this width a
 * touch device is either a tablet with the desktop mixer or one with the phone
 * mixer, and CSS cannot tell which. Touch contexts are swept below it only.
 */
const TOUCH_SWEEP_BELOW_PX = WIDTH.TABLET;

type Reading = { id: string; placeholder: number; content: number };

async function readModules(page: Page): Promise<Reading[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.module-deferred')).map((el) => {
      const placeholder = el.getBoundingClientRect().height;
      el.style.setProperty('content-visibility', 'visible');
      const content = el.getBoundingClientRect().height;
      el.style.removeProperty('content-visibility');
      return { id: el.id, placeholder, content };
    }),
  );
}

test.describe('deferred module estimates', () => {
  for (const locale of LOCALES) {
    for (const slice of SWEEP_SLICES) {
      test(`${locale.name}: each placeholder stays within its limit of the content it stands for from ${slice[0]}px to ${slice.at(-1)}px`, {
        tag: '@cross-browser',
      }, async ({ page }) => {
        const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
        const widths = touch ? slice.filter((w) => w < TOUCH_SWEEP_BELOW_PX) : slice;
        test.skip(
          widths.length === 0,
          `a touch context is swept below ${TOUCH_SWEEP_BELOW_PX}px only, and this slice starts above it`,
        );

        await page.setViewportSize({ width: WIDTH.DESKTOP, height: VIEWPORT_HEIGHT });
        await gotoSettled(page, locale.path);

        const drift: string[] = [];
        let readings = 0;
        for (const width of widths) {
          await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
          for (const { id, placeholder, content } of await readModules(page)) {
            const limit = OVERSHOOT_LIMIT[id as keyof typeof OVERSHOOT_LIMIT];
            expect(limit, `#${id} has no overshoot limit in this spec`).toBeDefined();
            readings += 1;
            const over = placeholder / content - 1;
            if (placeholder < content - SUBPIXEL_TOLERANCE_PX) {
              drift.push(
                `#${id} at ${width}px: placeholder ${Math.round(placeholder)}px is shorter than its ${Math.round(content)}px content, so its rows lie over the next section before it paints. Raise --module-estimate to at least ${Math.ceil(content)}px.`,
              );
            } else if (over > limit) {
              drift.push(
                `#${id} at ${width}px: placeholder ${Math.round(placeholder)}px is ${Math.round(over * PERCENT)}% taller than its ${Math.round(content)}px content (limit ${limit * PERCENT}%), so the page jumps ${Math.round(placeholder - content)}px when it resolves. Lower --module-estimate to at most ${Math.floor(content * (1 + limit))}px.`,
              );
            }
          }
        }

        expect(readings).toBe(widths.length * Object.keys(OVERSHOOT_LIMIT).length);
        expect(drift, `${drift.length} readings out of bounds`).toEqual([]);
      });
    }
  }
});
