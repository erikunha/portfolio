import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';

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
    expect(described).toContain('field-email-error');
  });
  it('does not set an empty aria-describedby when no error and no consumer value', () => {
    render(<Field name="email" label="Email" />);
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });
});
