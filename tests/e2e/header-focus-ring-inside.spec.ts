import { expect, type Locator, type Page, test } from '@playwright/test';
import { focusByKeyboard } from './_helpers/focus-ring-targets';
import { WIDTH } from './_helpers/geometry';
import { installMockBackend } from './_helpers/mock-backend';
import { gotoSettled } from './_helpers/streamed';

interface HeaderControl {
  name: string;
  selector: string;
}

interface RingGeometry {
  label: string;
  outer: { left: number; top: number; right: number; bottom: number };
  viewport: { width: number; height: number };
  width: number;
  covered: string[];
  overlapped: string[];
}

interface RingPaint {
  label: string;
  ring: number[];
  inside: number[];
}

const DESKTOP_HEADER = '.desktop-topbar';
const MOBILE_HEADER = '.mobile-title-bar';
const DESKTOP_VIEWPORT = { width: WIDTH.DESKTOP, height: 720 };
const MOBILE_VIEWPORT = { width: WIDTH.PHONE, height: 844 };
const FOCUS_RING_CONTRAST = 15.38;
const CONTRAST_TOLERANCE = 0.05;
const FOCUS_RGB = [0, 255, 65];
const CHANNEL_TOLERANCE = 2;
const SAMPLE_INSIDE_GAP_PX = 1;
const HALF = 2;
const CHANNEL_MAX = 255;
const SRGB_LINEAR_KNEE = 0.03928;
const SRGB_LINEAR_DIVISOR = 12.92;
const SRGB_GAMMA_OFFSET = 0.055;
const SRGB_GAMMA_DIVISOR = 1.055;
const SRGB_GAMMA_EXPONENT = 2.4;
const LUMINANCE_RED = 0.2126;
const LUMINANCE_GREEN = 0.7152;
const LUMINANCE_BLUE = 0.0722;
const CONTRAST_FLOOR = 0.05;
const RGBA_STRIDE = 4;

function headerControls(header: string): HeaderControl[] {
  return [
    { name: 'menu trigger', selector: `${header} .menu-trigger` },
    { name: 'locale link', selector: `${header} [data-lang-switch] a` },
    { name: 'brand link', selector: `${header} .brand-link` },
  ];
}

const DESKTOP_CONTROLS: HeaderControl[] = [
  ...headerControls(DESKTOP_HEADER),
  { name: 'section link', selector: `${DESKTOP_HEADER} .topbar-link` },
  { name: 'motion toggle', selector: `${DESKTOP_HEADER} .topbar-action-toggle` },
  { name: 'view cv action', selector: `${DESKTOP_HEADER} .topbar-action-outline` },
  { name: 'hire action', selector: `${DESKTOP_HEADER} .topbar-action-solid` },
];

const MOBILE_CONTROLS: HeaderControl[] = headerControls(MOBILE_HEADER);

const SURFACES = [
  { name: 'desktop', viewport: DESKTOP_VIEWPORT, controls: DESKTOP_CONTROLS },
  { name: 'phone', viewport: MOBILE_VIEWPORT, controls: MOBILE_CONTROLS },
];

function luminance([red, green, blue]: number[]): number {
  const linear = (channel: number | undefined) => {
    const unit = (channel ?? 0) / CHANNEL_MAX;
    return unit <= SRGB_LINEAR_KNEE
      ? unit / SRGB_LINEAR_DIVISOR
      : ((unit + SRGB_GAMMA_OFFSET) / SRGB_GAMMA_DIVISOR) ** SRGB_GAMMA_EXPONENT;
  };
  return (
    LUMINANCE_RED * linear(red) + LUMINANCE_GREEN * linear(green) + LUMINANCE_BLUE * linear(blue)
  );
}

function contrast(first: number[], second: number[]): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((light ?? 0) + CONTRAST_FLOOR) / ((dark ?? 0) + CONTRAST_FLOOR);
}

async function openHeader(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await installMockBackend(page, { log: 'accept', forget: 'happy' });
  await page.setViewportSize(viewport);
  await gotoSettled(page, '/');
}

async function settleTransitions(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        .map((animation) => animation.finished),
    ),
  );
}

async function readRingGeometry(target: Locator): Promise<RingGeometry> {
  return target.evaluate((node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const width = Number.parseFloat(style.outlineWidth);
    const reach = Number.parseFloat(style.outlineOffset) + width;
    const outer = {
      left: rect.left - reach,
      top: rect.top - reach,
      right: rect.right + reach,
      bottom: rect.bottom + reach,
    };
    const middleX = (outer.left + outer.right) / 2;
    const middleY = (outer.top + outer.bottom) / 2;
    const halfBand = width / 2;
    const samples = [
      { edge: 'top', x: middleX, y: outer.top + halfBand },
      { edge: 'bottom', x: middleX, y: outer.bottom - halfBand },
      { edge: 'left', x: outer.left + halfBand, y: middleY },
      { edge: 'right', x: outer.right - halfBand, y: middleY },
    ];
    const covered = samples
      .filter(({ x, y }) => {
        const hit = document.elementFromPoint(x, y);
        return !hit || !(node.contains(hit) || hit.contains(node));
      })
      .map(({ edge }) => edge);
    const offset = Number.parseFloat(style.outlineOffset);
    const glyphs: DOMRect[] = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.textContent?.trim() || text.parentElement?.closest('.sr-only')) continue;
      const range = document.createRange();
      range.selectNodeContents(text);
      glyphs.push(range.getBoundingClientRect());
    }
    const overlapped = [
      { edge: 'top', clear: glyphs.every((glyph) => glyph.top >= rect.top - offset) },
      { edge: 'bottom', clear: glyphs.every((glyph) => glyph.bottom <= rect.bottom + offset) },
      { edge: 'left', clear: glyphs.every((glyph) => glyph.left >= rect.left - offset) },
      { edge: 'right', clear: glyphs.every((glyph) => glyph.right <= rect.right + offset) },
    ]
      .filter(({ clear }) => !clear)
      .map(({ edge }) => edge);
    return {
      label: node.getAttribute('class') ?? node.tagName.toLowerCase(),
      outer,
      overlapped,
      viewport: { width: document.documentElement.clientWidth, height: window.innerHeight },
      width,
      covered,
    };
  });
}

async function readRingPaint(page: Page, target: Locator): Promise<RingPaint> {
  const geometry = await readRingGeometry(target);
  const clip = {
    x: Math.max(0, Math.floor(geometry.outer.left)),
    y: Math.max(0, Math.floor(geometry.outer.top)),
    width: Math.ceil(geometry.outer.right) - Math.max(0, Math.floor(geometry.outer.left)),
    height: Math.ceil(geometry.outer.bottom) - Math.max(0, Math.floor(geometry.outer.top)),
  };
  const shot = await page.screenshot({ clip, scale: 'css' });
  const middleX = Math.floor((geometry.outer.left + geometry.outer.right) / HALF) - clip.x;
  const ringY = Math.floor(geometry.outer.top + geometry.width / HALF) - clip.y;
  const insideY = Math.floor(geometry.outer.top + geometry.width + SAMPLE_INSIDE_GAP_PX) - clip.y;
  const decoder = await page.context().newPage();
  const pixels = await decoder.evaluate(
    async ({ url, points, stride }) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('the page has no 2d canvas context');
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, image.width, image.height).data;
      return points.map(({ x, y }) => {
        const at = (y * image.width + x) * stride;
        return [data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0];
      });
    },
    {
      url: `data:image/png;base64,${shot.toString('base64')}`,
      points: [
        { x: middleX, y: ringY },
        { x: middleX, y: insideY },
      ],
      stride: RGBA_STRIDE,
    },
  );
  await decoder.close();
  return {
    label: geometry.label,
    ring: pixels[0] ?? [],
    inside: pixels[1] ?? [],
  };
}

async function visibleControls(page: Page, control: HeaderControl): Promise<Locator[]> {
  const matches = page.locator(control.selector);
  const found: Locator[] = [];
  for (let index = 0; index < (await matches.count()); index++) {
    const candidate = matches.nth(index);
    if (await candidate.isVisible()) found.push(candidate);
  }
  return found;
}

function geometryOffenders(geometry: RingGeometry): string[] {
  const { outer, viewport, covered, overlapped, label } = geometry;
  const problems: string[] = [];
  if (outer.top < 0) problems.push(`top edge at ${outer.top}px is above the viewport`);
  if (outer.left < 0) problems.push(`left edge at ${outer.left}px is left of the viewport`);
  if (outer.right > viewport.width) {
    problems.push(`right edge at ${outer.right}px is past the ${viewport.width}px viewport`);
  }
  if (outer.bottom > viewport.height) {
    problems.push(`bottom edge at ${outer.bottom}px is below the ${viewport.height}px viewport`);
  }
  if (covered.length > 0) problems.push(`${covered.join(', ')} edge hits another element`);
  if (overlapped.length > 0)
    problems.push(`${overlapped.join(', ')} ring edge crosses the content`);
  return problems.map((problem) => `${label}: ${problem}`);
}

for (const { name, viewport, controls } of SURFACES) {
  test.describe(`header focus ring at ${name}`, () => {
    test.use({ viewport });

    for (const control of controls) {
      test(`the ${control.name} ring lies inside the viewport and is not covered`, async ({
        page,
      }) => {
        await openHeader(page, viewport);
        const targets = await visibleControls(page, control);
        expect(targets.length, `${control.selector} must be visible`).toBeGreaterThan(0);
        const offenders: string[] = [];
        for (const target of targets) {
          await focusByKeyboard(page, target);
          await settleTransitions(page);
          offenders.push(...geometryOffenders(await readRingGeometry(target)));
        }
        expect(offenders).toEqual([]);
      });

      test(`the ${control.name} ring is the focus colour and keeps its contrast`, async ({
        page,
      }) => {
        await openHeader(page, viewport);
        const targets = await visibleControls(page, control);
        expect(targets.length, `${control.selector} must be visible`).toBeGreaterThan(0);
        for (const target of targets) {
          await focusByKeyboard(page, target);
          await settleTransitions(page);
          const paint = await readRingPaint(page, target);
          FOCUS_RGB.forEach((channel, index) => {
            expect(
              Math.abs((paint.ring[index] ?? 0) - channel),
              `${paint.label}: the ring pixel is ${paint.ring.join(',')}`,
            ).toBeLessThanOrEqual(CHANNEL_TOLERANCE);
          });
          expect(
            contrast(paint.ring, paint.inside),
            `${paint.label}: ring ${paint.ring.join(',')} against ${paint.inside.join(',')}`,
          ).toBeGreaterThanOrEqual(FOCUS_RING_CONTRAST - CONTRAST_TOLERANCE);
        }
      });
    }
  });

  test.describe(`header focus ring in forced colors at ${name}`, () => {
    test.use({ viewport, forcedColors: 'active' });

    for (const control of controls) {
      test(`the ${control.name} highlight ring lies inside the viewport and is not covered`, async ({
        page,
      }) => {
        await openHeader(page, viewport);
        const targets = await visibleControls(page, control);
        expect(targets.length, `${control.selector} must be visible`).toBeGreaterThan(0);
        const offenders: string[] = [];
        for (const target of targets) {
          await focusByKeyboard(page, target);
          offenders.push(...geometryOffenders(await readRingGeometry(target)));
        }
        expect(offenders).toEqual([]);
      });
    }
  });
}
