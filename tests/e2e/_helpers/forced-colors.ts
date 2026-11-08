import type { Locator, Page } from '@playwright/test';

export const FORCED_ROUTES = ['/', '/pt', '/cv', '/links', '/design-system'] as const;

export const DECORATIVE_SELECTORS = ['[data-testid^="crt-"]', 'canvas[aria-hidden]'] as const;

export interface ControlProbe {
  name: string;
  route: string;
  selector: string;
}

export const DESKTOP_CONTROLS: readonly ControlProbe[] = [
  { name: 'menu trigger', route: '/', selector: '.menu-trigger' },
  { name: 'topbar action', route: '/', selector: '.topbar-action' },
  { name: 'shell input', route: '/', selector: '.shell-input' },
  { name: 'shell command hint', route: '/', selector: '.shell-cmd-hint' },
  { name: 'contact name field', route: '/', selector: '.contact-form input[name="name"]' },
  { name: 'contact message field', route: '/', selector: '.contact-form textarea' },
  { name: 'contact send', route: '/', selector: '.contact-send' },
  { name: 'fader', route: '/', selector: '#sec-guitar .fader-track' },
  { name: 'fader thumb', route: '/', selector: '#sec-guitar .faderThumb' },
  { name: 'vu meter', route: '/', selector: '#sec-guitar .vu-meter' },
  { name: 'links line', route: '/links', selector: '.links-line' },
  { name: 'design system nav item', route: '/design-system', selector: '.ds-nav-item' },
];

export const FOCUS_OUTLINE_CONTROLS: readonly ControlProbe[] = [
  { name: 'shell input', route: '/', selector: '.shell-input' },
  { name: 'contact name field', route: '/', selector: '.contact-form input[name="name"]' },
  { name: 'contact message field', route: '/', selector: '.contact-form textarea' },
  { name: 'contact send', route: '/', selector: '.contact-send' },
  { name: 'menu trigger', route: '/', selector: '.menu-trigger' },
  { name: 'topbar action', route: '/', selector: '.topbar-action' },
];

export const MOBILE_CONTROLS: readonly ControlProbe[] = [
  { name: 'dock link', route: '/', selector: '.dock > a, .dock > button' },
  { name: 'menu trigger', route: '/', selector: '.menu-trigger' },
];

export const STATE_PROPERTIES = [
  'border-top-width',
  'border-top-style',
  'border-top-color',
  'border-right-width',
  'border-right-style',
  'border-right-color',
  'border-bottom-width',
  'border-bottom-style',
  'border-bottom-color',
  'border-left-width',
  'border-left-style',
  'border-left-color',
  'outline-width',
  'outline-style',
  'outline-color',
  'text-decoration-line',
] as const;

export const DEFAULT_STYLE_PROPERTIES = [
  ...STATE_PROPERTIES,
  'background-color',
  'background-image',
  'box-shadow',
  'text-shadow',
  'opacity',
] as const;

export const DECORATIVE_STYLE_PROPERTIES = ['display', 'visibility'] as const;

export async function readStyles(
  target: Locator,
  properties: readonly string[],
): Promise<Record<string, string>> {
  return target.evaluate((node, props) => {
    const style = getComputedStyle(node);
    return Object.fromEntries(props.map((prop) => [prop, style.getPropertyValue(prop)]));
  }, properties);
}

export async function hasBoundary(target: Locator): Promise<boolean> {
  return target.evaluate((node) => {
    const style = getComputedStyle(node);
    const OPAQUE_ENOUGH = 0.01;
    const alphaOf = (color: string): number => {
      const match = color.match(/rgba?\(([^)]+)\)/);
      if (!match) return 1;
      const parts = (match[1] ?? '').split(/[ ,/]+/).filter(Boolean);
      return parts.length > 3 ? Number.parseFloat(parts[3] ?? '1') : 1;
    };
    const drawn = (width: string, line: string, color: string): boolean =>
      Number.parseFloat(width) > 0 &&
      line !== 'none' &&
      line !== 'hidden' &&
      alphaOf(color) > OPAQUE_ENOUGH;
    const sides = ['top', 'right', 'bottom', 'left'];
    const border = sides.some((side) =>
      drawn(
        style.getPropertyValue(`border-${side}-width`),
        style.getPropertyValue(`border-${side}-style`),
        style.getPropertyValue(`border-${side}-color`),
      ),
    );
    return (
      border ||
      drawn(
        style.getPropertyValue('outline-width'),
        style.getPropertyValue('outline-style'),
        style.getPropertyValue('outline-color'),
      )
    );
  });
}

export const SYSTEM_COLORS = [
  'Canvas',
  'CanvasText',
  'Highlight',
  'HighlightText',
  'ButtonFace',
  'ButtonText',
  'ButtonBorder',
  'GrayText',
  'LinkText',
  'VisitedText',
  'ActiveText',
  'Field',
  'FieldText',
  'Mark',
  'MarkText',
  'SelectedItem',
  'SelectedItemText',
] as const;

export type SystemColor = (typeof SYSTEM_COLORS)[number];

export const STATE_BORDER_FLOOR_PX = 3;
export const HAIRLINE_PX = 1;
export const BOLD_WEIGHT = 700;

export async function resolveSystemColors(page: Page): Promise<Record<SystemColor, string>> {
  return page.evaluate((keywords) => {
    const probe = document.createElement('span');
    document.body.append(probe);
    const resolved = Object.fromEntries(
      keywords.map((keyword) => {
        probe.style.color = keyword;
        return [keyword, getComputedStyle(probe).color];
      }),
    );
    probe.remove();
    return resolved;
  }, SYSTEM_COLORS) as Promise<Record<SystemColor, string>>;
}

export async function px(target: Locator, property: string): Promise<number> {
  const value = (await readStyles(target, [property]))[property] ?? '0';
  return Number.parseFloat(value);
}

export interface SvgPaintLeak {
  element: string;
  property: string;
  value: string;
}

export async function findSvgPaintLeaks(
  page: Page,
  allowed: readonly string[],
): Promise<SvgPaintLeak[]> {
  return page.evaluate((palette) => {
    const NO_PAINT = new Set(['none', 'transparent', 'rgba(0, 0, 0, 0)']);
    const leaks: { element: string; property: string; value: string }[] = [];
    for (const node of document.querySelectorAll('svg *')) {
      const style = getComputedStyle(node);
      for (const property of ['fill', 'stroke']) {
        const value = style.getPropertyValue(property);
        if (!NO_PAINT.has(value) && !palette.includes(value) && !value.startsWith('url(')) {
          leaks.push({
            element: `${node.tagName.toLowerCase()}.${node.getAttribute('class') ?? ''}`,
            property,
            value,
          });
        }
      }
    }
    return leaks;
  }, allowed);
}

export async function findVanishedIndicators(
  page: Page,
  selector: string,
  canvas: string,
): Promise<string[]> {
  return page.evaluate(
    ([target, canvasColor]) => {
      const sides = ['top', 'right', 'bottom', 'left'];
      return [...document.querySelectorAll(target)]
        .filter((node) => {
          const style = getComputedStyle(node);
          const bounds = node.getBoundingClientRect();
          if (bounds.width < 1 || bounds.height < 1 || style.display === 'none') return false;
          const drawnBorder = sides.some(
            (side) =>
              Number.parseFloat(style.getPropertyValue(`border-${side}-width`)) > 0 &&
              style.getPropertyValue(`border-${side}-style`) !== 'none',
          );
          const drawnOutline =
            style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0;
          return style.backgroundColor === canvasColor && !drawnBorder && !drawnOutline;
        })
        .map((node) => `${node.tagName.toLowerCase()}.${node.getAttribute('class') ?? ''}`);
    },
    [selector, canvas] as const,
  );
}
