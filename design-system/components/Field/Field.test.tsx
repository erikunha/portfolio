import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getThemeColors } from '@/app/(en)/design-system/_lib/theme-tokens';
import { Field } from './Field';

const NON_TEXT_MIN_CONTRAST = 3;
const CHANNEL_MAX = 255;
const HEX_RADIX = 16;
const HEX_PAIR = 2;
const OPAQUE_HEX_LENGTH = 6;

function luminance(channels: number[]): number {
  const [r = 0, g = 0, b = 0] = channels.map((channel) => {
    const s = channel / CHANNEL_MAX;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastOnBlack(hex: string): number {
  const digits = hex.replace('#', '');
  const alpha =
    digits.length > OPAQUE_HEX_LENGTH
      ? Number.parseInt(digits.slice(OPAQUE_HEX_LENGTH), HEX_RADIX) / CHANNEL_MAX
      : 1;
  const channels = [0, 1, 2].map(
    (i) => alpha * Number.parseInt(digits.slice(i * HEX_PAIR, i * HEX_PAIR + HEX_PAIR), HEX_RADIX),
  );
  return (luminance(channels) + 0.05) / 0.05;
}

describe('Field', () => {
  it('renders a label associated with the input', () => {
    render(<Field name="email" label="Email" />);
    const label = screen.getByText('Email');
    const input = screen.getByRole('textbox');
    expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
  });
  it('renders textarea when multiline=true', () => {
    render(<Field name="msg" label="Message" multiline rows={4} />);
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
  });
  it('renders error text and aria-invalid on error', () => {
    render(<Field name="email" label="Email" error="Required" />);
    expect(screen.getByText('Required')).toBeDefined();
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
  });
  it('links error text via aria-describedby', () => {
    render(<Field name="email" label="Email" error="Bad input" />);
    const input = screen.getByRole('textbox');
    const errId = input.getAttribute('aria-describedby');
    expect(errId).toBeDefined();
    expect(document.getElementById(errId ?? '')?.textContent).toBe('Bad input');
  });
  it('merges consumer aria-describedby with error id', () => {
    render(<Field name="email" label="Email" error="Required" aria-describedby="hint-id" />);
    const input = screen.getByRole('textbox');
    const described = input.getAttribute('aria-describedby') ?? '';
    expect(described).toContain('hint-id');
    expect(described).toContain(`${screen.getByRole('textbox').id}-error`);
  });
  it('does not set an empty aria-describedby when no error and no consumer value', () => {
    render(<Field name="email" label="Email" />);
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });
  it('gives two fields with the same name distinct ids and their own labels', () => {
    render(
      <>
        <Field name="email" label="First" />
        <Field name="email" label="Second" />
      </>,
    );
    const [first, second] = screen.getAllByRole('textbox');
    expect(first?.id).toBeTruthy();
    expect(first?.id).not.toBe(second?.id);
    expect(screen.getByText('First').getAttribute('for')).toBe(first?.id);
    expect(screen.getByText('Second').getAttribute('for')).toBe(second?.id);
  });
  it('keeps a consumer id and derives the error id from it', () => {
    render(<Field name="email" label="Email" id="mine" error="Bad" />);
    expect(screen.getByRole('textbox').id).toBe('mine');
    expect(document.getElementById('mine-error')?.textContent).toBe('Bad');
  });
  it('draws the resting border at 3:1 or better against the page (WCAG 1.4.11)', () => {
    render(<Field name="email" label="Email" />);
    const borderClass = [...screen.getByRole('textbox').classList].find((name) =>
      /^border-[a-z]+-\d+$|^border-[a-z]+-[a-z]+$/.test(name),
    );
    expect(borderClass).toBeDefined();
    const colors = getThemeColors();
    const border = colors[(borderClass ?? '').replace('border-', '')];
    expect(border).toBeDefined();
    expect(contrastOnBlack(border ?? '')).toBeGreaterThanOrEqual(NON_TEXT_MIN_CONTRAST);
  });
});
