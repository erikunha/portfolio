import type { ContactContent } from '@/content/contact';
import {
  CONTACT_EMAIL_PATTERN,
  CONTACT_FIELD,
  CONTACT_LIMITS,
  type ContactField,
} from '@/content/contact-rules';

const MAILTO_SHORT_REF_LENGTH = 8;
const MAILTO_REF_TOKEN = '{ref}';
const MAILTO_TEXT_TOKEN = '{text}';

export const FIELD_CHECKS: Record<ContactField, (value: string) => boolean> = {
  [CONTACT_FIELD.NAME]: (value) => {
    const length = value.trim().length;
    return length >= CONTACT_LIMITS.nameMin && length <= CONTACT_LIMITS.nameMax;
  },
  [CONTACT_FIELD.EMAIL]: (value) => CONTACT_EMAIL_PATTERN.test(value.trim()),
  [CONTACT_FIELD.MESSAGE]: (value) => {
    const length = value.trim().length;
    return length >= CONTACT_LIMITS.messageMin && length <= CONTACT_LIMITS.messageMax;
  },
};

export function errorMailto(copy: ContactContent, ref: string, text: string): string {
  const base = `mailto:${copy.section.email}`;
  if (!ref) return base;
  const subject = copy.form.mailtoSubject.replace(MAILTO_REF_TOKEN, () =>
    ref.slice(0, MAILTO_SHORT_REF_LENGTH),
  );
  const body = copy.form.mailtoBody
    .replace(MAILTO_REF_TOKEN, () => ref)
    .replace(MAILTO_TEXT_TOKEN, () => text);
  return `${base}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
