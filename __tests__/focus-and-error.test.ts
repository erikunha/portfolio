import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const base    = readFileSync(path.resolve(__dirname, '../app/css/_base.css'), 'utf-8');
const contact = readFileSync(path.resolve(__dirname, '../components/client/ContactForm.tsx'), 'utf-8');

describe('focus rings', () => {
  it('base CSS has button:focus-visible rule', () => {
    expect(base).toMatch(/button:focus-visible/);
  });
});

describe('contact form error', () => {
  it('error paragraph has role="alert"', () => {
    expect(contact).toContain('role="alert"');
  });
});
