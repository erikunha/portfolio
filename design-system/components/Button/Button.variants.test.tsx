import { fireEvent, render, screen } from '@testing-library/react';
import type { Rule } from 'postcss';
import { describe, expect, it, vi } from 'vitest';
import {
  compiledSiteStylesheet,
  declValue,
  rulesInMedia,
  rulesWithResolvedSelector,
} from '../../../__tests__/helpers/css-rules';
import { Button, type ButtonSize, type ButtonVariant } from './Button';

const VARIANTS: ButtonVariant[] = ['primary', 'secondary'];
const SIZES: ButtonSize[] = ['sm', 'md', 'lg'];
const FINE_POINTER = /pointer:\s*fine/;
const HOVER_CAPABLE = /hover:\s*hover/;
const BASE = '.btn';
const MOTION_OFF = /data-motion/;
const DISABLED_OPACITY = 'var(--btn-disabled-opacity)';
const BORDER_DECLARATIONS = ['border-style', 'border-width'] as const;

describe('Button markup', () => {
  it.each(VARIANTS)('renders .btn with data-variant=%s on a button and on an anchor', (variant) => {
    const { container } = render(
      <>
        <Button variant={variant}>Action</Button>
        <Button as="a" href="/x" variant={variant}>
          Link
        </Button>
      </>,
    );
    const controls = [...container.querySelectorAll('.btn')];
    expect(controls.map((node) => node.tagName)).toEqual(['BUTTON', 'A']);
    for (const control of controls) expect(control.getAttribute('data-variant')).toBe(variant);
  });

  it.each(SIZES)('renders data-size=%s', (size) => {
    const { container } = render(<Button size={size}>Sized</Button>);
    expect(container.querySelector('.btn')?.getAttribute('data-size')).toBe(size);
  });

  it('defaults to the primary variant and the medium size', () => {
    render(<Button>Default</Button>);
    const control = screen.getByRole('button');
    expect(control.getAttribute('data-variant')).toBe('primary');
    expect(control.getAttribute('data-size')).toBe('md');
  });

  it('carries the base class and the consumer class and nothing else', () => {
    render(
      <>
        <Button variant="secondary" size="lg" className="consumer">
          Button
        </Button>
        <Button as="a" href="/x" className="consumer">
          Link
        </Button>
      </>,
    );
    expect(screen.getByRole('button').className).toBe('btn consumer');
    expect(screen.getByRole('link').className).toBe('btn consumer');
  });

  it('adds no class when the caller passes none', () => {
    render(<Button>Plain</Button>);
    expect(screen.getByRole('button').className).toBe('btn');
  });

  it('disables a button natively and keeps type=button', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Off
      </Button>,
    );
    const control = screen.getByRole('button');
    expect(control.hasAttribute('disabled')).toBe(true);
    expect(control.getAttribute('type')).toBe('button');
    fireEvent.click(control);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disables an anchor through aria-disabled, no href and no tab stop', () => {
    const onClick = vi.fn();
    render(
      <Button as="a" href="/x" disabled onClick={onClick}>
        Off
      </Button>,
    );
    const control = screen.getByText('Off');
    expect(control.getAttribute('aria-disabled')).toBe('true');
    expect(control.hasAttribute('href')).toBe(false);
    expect(control.getAttribute('tabindex')).toBe('-1');
    expect(fireEvent.click(control)).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps href and consumer attributes on an enabled anchor', () => {
    render(
      <Button as="a" href="/x" target="_blank" rel="noopener" aria-label="Open x">
        Link
      </Button>,
    );
    const control = screen.getByRole('link', { name: 'Open x' });
    expect(control.getAttribute('href')).toBe('/x');
    expect(control.getAttribute('target')).toBe('_blank');
    expect(control.hasAttribute('aria-disabled')).toBe(false);
  });
});

describe('Button stylesheet', () => {
  it('writes the border, focus, target size and motion once on the base class', async () => {
    const root = await compiledSiteStylesheet();
    const base = rulesWithResolvedSelector(root, BASE);
    for (const property of BORDER_DECLARATIONS) {
      expect(base.filter((rule) => declValue(rule, property) !== undefined)).toHaveLength(1);
    }
    expect(base.map((rule) => declValue(rule, 'min-height')).filter(Boolean)).toHaveLength(1);
    expect(base.map((rule) => declValue(rule, 'min-width')).filter(Boolean)).toHaveLength(1);
    expect(
      rulesWithResolvedSelector(root, `${BASE}:focus-visible`).map((rule) =>
        declValue(rule, 'outline'),
      ),
    ).toEqual(['var(--focus-ring)']);
    const motionOff = base
      .flatMap((rule) => rule.nodes)
      .filter((node): node is Rule => node.type === 'rule' && MOTION_OFF.test(node.selector));
    expect(motionOff.map((rule) => declValue(rule, 'transition-property'))).toEqual(['none']);
  });

  it.each([
    ['primary', 'var(--color-accent)', 'var(--color-on-accent)', 'var(--color-accent)'],
    ['secondary', 'transparent', 'var(--color-accent)', 'var(--color-border-strong)'],
  ])('paints %s from its own data-variant rule', async (variant, background, color, border) => {
    const root = await compiledSiteStylesheet();
    const rules = rulesWithResolvedSelector(root, `${BASE}[data-variant="${variant}"]`);
    const painted = rules.find((rule) => declValue(rule, 'color') !== undefined);
    expect(declValue(painted, 'background-color')).toBe(background);
    expect(declValue(painted, 'color')).toBe(color);
    expect(declValue(painted, 'border-color')).toBe(border);
  });

  it('glows on hover only where hover exists, and the secondary variant also tints', async () => {
    const root = await compiledSiteStylesheet();
    const glow = rulesInMedia(root, HOVER_CAPABLE, `${BASE}:hover`);
    expect(glow.map((rule) => declValue(rule, 'box-shadow'))).toEqual(['var(--shadow-glow)']);
    const tint = rulesInMedia(root, HOVER_CAPABLE, `${BASE}[data-variant="secondary"]:hover`);
    expect(tint.map((rule) => declValue(rule, 'background-color'))).toEqual([
      'var(--color-signal-quiet)',
    ]);
  });

  it('dims a disabled control and removes its pointer events', async () => {
    const root = await compiledSiteStylesheet();
    for (const selector of [`${BASE}:disabled`, `${BASE}[aria-disabled="true"]`]) {
      const rules = rulesWithResolvedSelector(root, selector);
      expect(rules.map((rule) => declValue(rule, 'pointer-events'))).toContain('none');
      expect(rules.map((rule) => declValue(rule, 'opacity'))).toContain(DISABLED_OPACITY);
    }
  });

  it('steps only the small size down on a fine pointer', async () => {
    const root = await compiledSiteStylesheet();
    const fine = rulesInMedia(root, FINE_POINTER, `${BASE}[data-size="sm"]`);
    expect(fine.map((rule) => declValue(rule, 'min-height'))).toEqual([
      'var(--spacing-target-pointer)',
    ]);
    expect(rulesInMedia(root, FINE_POINTER, `${BASE}[data-size="lg"]`)).toHaveLength(0);
    expect(rulesInMedia(root, FINE_POINTER, `${BASE}[data-size="md"]`)).toHaveLength(0);
  });
});
