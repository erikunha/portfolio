import { describe, expect, it } from 'vitest';

import { ContactSchema } from '@/lib/contact-validation';

const valid = {
  name: 'Visitor',
  email: 'visitor@example.com',
  message: 'A private contact message.',
};

describe('ContactSchema header safety', () => {
  it.each([
    ['carriage return', 'Visitor\rBcc: victim@example.com'],
    ['line feed', 'Visitor\nBcc: victim@example.com'],
    ['null byte', 'Visitor\u0000'],
    ['unicode line separator', 'Visitor Bcc: victim@example.com'],
  ])('rejects a name with a %s because it becomes the email subject', (_label, name) => {
    expect(ContactSchema.safeParse({ ...valid, name }).success).toBe(false);
  });

  it('keeps accepting ordinary names with accents, spaces and apostrophes', () => {
    expect(ContactSchema.safeParse({ ...valid, name: "Zoë O'Brien-Çelik" }).success).toBe(true);
  });

  it('keeps newlines in the message body', () => {
    expect(
      ContactSchema.safeParse({ ...valid, message: 'line one\nline two, long enough' }).success,
    ).toBe(true);
  });

  it('rejects an email longer than the 254 character address limit', () => {
    const email = `${'a'.repeat(250)}@example.com`;
    expect(ContactSchema.safeParse({ ...valid, email }).success).toBe(false);
  });
});
