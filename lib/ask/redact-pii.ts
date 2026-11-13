export const EMAIL_PLACEHOLDER = '[redacted-email]';

export const PHONE_PLACEHOLDER = '[redacted-phone]';

const PHONE_MIN_DIGITS = 9;

const EMAIL_RE = /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;

const PHONE_GROUPED_RE = /(?<![\w.])\+?\(?\d{1,4}\)?(?:[\s.-]\(?\d{2,5}\)?){2,5}(?!\w)/g;

const PHONE_BARE_RE = /(?<![\w.])\+?\d{10,15}(?!\w)/g;

function digitCount(text: string): number {
  return text.replace(/\D/g, '').length;
}

export function redactPii(text: string): string {
  return text
    .replace(EMAIL_RE, EMAIL_PLACEHOLDER)
    .replace(PHONE_GROUPED_RE, (match) =>
      digitCount(match) >= PHONE_MIN_DIGITS ? PHONE_PLACEHOLDER : match,
    )
    .replace(PHONE_BARE_RE, PHONE_PLACEHOLDER);
}
