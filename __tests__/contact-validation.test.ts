import { describe, expect, it } from 'vitest';
import { validateContact } from '@/lib/contact-validation';

describe('contact payload validation', () => {
  it('rejects empty name', () => {
    const r = validateContact({ name: '', email: 'a@b.com', message: 'hello there recruiter' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('all fields required');
  });

  it('rejects invalid email', () => {
    const r = validateContact({
      name: 'Erik',
      email: 'notanemail',
      message: 'hello there recruiter',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid email address');
  });

  it('rejects message shorter than 10 chars', () => {
    const r = validateContact({ name: 'Erik', email: 'a@b.com', message: 'short' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('message too short');
  });

  it('rejects message longer than 2000 chars', () => {
    const r = validateContact({ name: 'Erik', email: 'a@b.com', message: 'a'.repeat(2001) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('message too long (max 2000 chars)');
  });

  it('accepts a valid payload', () => {
    const r = validateContact({
      name: 'Erik',
      email: 'a@b.com',
      message: 'Hello, I would like to connect.',
    });
    expect(r.ok).toBe(true);
  });
});
