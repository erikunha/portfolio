const SIDES = ['top', 'right', 'bottom', 'left'] as const;

type Side = (typeof SIDES)[number];

interface Border {
  width: string;
  style: string;
  color: string;
}

interface ControlRule {
  borders: Record<Side, Border>;
  outlineColor: string;
  backgroundColor: string;
  boxShadow?: string;
}

const OUTLINE_WIDTH = '3px';
const NO_SHADOW = 'none';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const SIGNAL = 'rgb(0, 255, 65)';
const BODY_TEXT = 'rgb(230, 255, 230)';
const BLACK = 'rgb(0, 0, 0)';
const SIGNAL_BORDER_40 = 'rgba(0, 255, 65, 0.4)';
const SIGNAL_BORDER_10 = 'rgba(0, 255, 65, 0.1)';
const SIGNAL_BORDER_20 = 'rgba(0, 255, 65, 0.2)';

const solid = (color: string): Border => ({ width: '1px', style: 'solid', color });
const noBorder: Border = { width: '0px', style: 'none', color: BODY_TEXT };

const uniform = (border: Border): Record<Side, Border> => ({
  top: border,
  right: border,
  bottom: border,
  left: border,
});

function buildControlStyles(rule: ControlRule): Record<string, string> {
  const styles: Record<string, string> = {};
  for (const side of SIDES) {
    const { width, style, color } = rule.borders[side];
    styles[`border-${side}-width`] = width;
    styles[`border-${side}-style`] = style;
    styles[`border-${side}-color`] = color;
  }
  styles['outline-width'] = OUTLINE_WIDTH;
  styles['outline-style'] = 'none';
  styles['outline-color'] = rule.outlineColor;
  styles['text-decoration-line'] = 'none';
  styles['background-color'] = rule.backgroundColor;
  styles['background-image'] = 'none';
  styles['box-shadow'] = rule.boxShadow ?? NO_SHADOW;
  styles['text-shadow'] = 'none';
  styles.opacity = '1';
  return styles;
}

const CONTROL_RULES: Record<string, ControlRule> = {
  '/ .menu-trigger': {
    borders: uniform(solid(SIGNAL_BORDER_40)),
    outlineColor: SIGNAL,
    backgroundColor: TRANSPARENT,
  },
  '/ .topbar-action': {
    borders: uniform(solid(SIGNAL_BORDER_40)),
    outlineColor: 'rgb(74, 222, 128)',
    backgroundColor: TRANSPARENT,
  },
  '/ .shell-input': {
    borders: uniform(noBorder),
    outlineColor: BODY_TEXT,
    backgroundColor: TRANSPARENT,
  },
  '/ .shell-cmd-hint': {
    borders: uniform(solid(SIGNAL_BORDER_40)),
    outlineColor: SIGNAL,
    backgroundColor: TRANSPARENT,
  },
  '/ .contact-form input[name="name"]': {
    borders: uniform(solid(SIGNAL)),
    outlineColor: BODY_TEXT,
    backgroundColor: TRANSPARENT,
  },
  '/ .contact-form textarea': {
    borders: uniform(solid(SIGNAL)),
    outlineColor: BODY_TEXT,
    backgroundColor: TRANSPARENT,
  },
  '/ .contact-send': {
    borders: uniform(solid(SIGNAL)),
    outlineColor: BLACK,
    backgroundColor: SIGNAL,
  },
  '/ #sec-guitar .fader-track': {
    borders: uniform(solid(SIGNAL_BORDER_10)),
    outlineColor: BODY_TEXT,
    backgroundColor: 'color(srgb 0 1 0.254902 / 0.03)',
  },
  '/ #sec-guitar .faderThumb': {
    borders: uniform(solid(BLACK)),
    outlineColor: BODY_TEXT,
    backgroundColor: SIGNAL,
    boxShadow: 'rgb(0, 255, 65) 0px 0px 8px 0px',
  },
  '/ #sec-guitar .vu-meter': {
    borders: uniform(solid(SIGNAL_BORDER_10)),
    outlineColor: BODY_TEXT,
    backgroundColor: 'color(srgb 0 0 0 / 0.7)',
  },
  '/links .links-line': {
    borders: { ...uniform(noBorder), bottom: solid(SIGNAL_BORDER_20) },
    outlineColor: BODY_TEXT,
    backgroundColor: TRANSPARENT,
  },
  '/design-system .ds-nav-item': {
    borders: uniform(solid(TRANSPARENT)),
    outlineColor: 'rgb(161, 179, 161)',
    backgroundColor: TRANSPARENT,
  },
};

export const DEFAULT_CONTROL_STYLES: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(CONTROL_RULES).map(([selector, rule]) => [selector, buildControlStyles(rule)]),
);

export const DEFAULT_DECORATIVE_STYLES: Record<string, Record<string, string>> = {
  '[data-testid^="crt-"]': {
    display: 'block',
    visibility: 'visible',
  },
  'canvas[aria-hidden]': {
    display: 'block',
    visibility: 'visible',
  },
};
