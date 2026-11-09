import type { ContactContent } from './contact';

export const CONTACT_LIMITS = {
  nameMin: 1,
  nameMax: 120,
  messageMin: 10,
  messageMax: 2_000,
} as const;

export const CONTACT_EMAIL_PATTERN =
  /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

export const CONTACT_FIELD = {
  NAME: 'name',
  EMAIL: 'email',
  MESSAGE: 'message',
} as const;

export type ContactField = (typeof CONTACT_FIELD)[keyof typeof CONTACT_FIELD];

export const FIELD_ERROR_PREFIX = '> ';
const EMAIL_AT = '@';
const EMAIL_DOMAIN_PATTERN = /\.[A-Za-z]{2,}$/;

export const CONTACT_DELIVERY_CODE = { QUEUED: 'queued' } as const;

export const CONTACT_ERROR_CODE = {
  RATE_LIMITED: 'rate_limited',
  STORAGE_UNAVAILABLE: 'storage_unavailable',
  DELIVERY_UNAVAILABLE: 'delivery_unavailable',
  FORBIDDEN_ORIGIN: 'forbidden_origin',
} as const;

export function contactErrorSummary(copy: ContactContent, count: number): string {
  const { one, many } = copy.form.errorSummary;
  return count === 1 ? one : many.replace('{count}', String(count));
}

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;
const HOURS_DECIMALS = 2;
const SINGULAR_HOURS = 1;

export function fillCopy(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(PLACEHOLDER_PATTERN, (token, key: string) => {
    const value = values[key];
    return value === undefined ? token : String(value);
  });
}

export function contactHoursPhrase(
  hoursCopy: { one: string; other: string },
  hours: number,
): string {
  return fillCopy(hours === SINGULAR_HOURS ? hoursCopy.one : hoursCopy.other, {
    count: Number(hours.toFixed(HOURS_DECIMALS)),
  });
}

export function contactErrorMessage(copy: ContactContent, code: string | undefined): string {
  switch (code) {
    case CONTACT_ERROR_CODE.RATE_LIMITED:
      return copy.errors.rateLimited;
    case CONTACT_ERROR_CODE.STORAGE_UNAVAILABLE:
      return copy.errors.storageUnavailable;
    case CONTACT_ERROR_CODE.DELIVERY_UNAVAILABLE:
      return copy.errors.retryUnavailable;
    case CONTACT_ERROR_CODE.FORBIDDEN_ORIGIN:
      return copy.errors.forbiddenOrigin;
    default:
      return copy.errors.requestFailed;
  }
}

export function contactFieldError(
  copy: ContactContent,
  field: ContactField,
  value: string,
): string {
  const trimmed = value.trim();
  const count = trimmed.length;
  const { errors } = copy;
  const limits = { min: CONTACT_LIMITS.messageMin, max: CONTACT_LIMITS.messageMax, count };
  const text = (() => {
    if (field === CONTACT_FIELD.NAME) {
      return count < CONTACT_LIMITS.nameMin
        ? errors.name.required
        : fillCopy(errors.name.tooLong, { max: CONTACT_LIMITS.nameMax, count });
    }
    if (field === CONTACT_FIELD.EMAIL) {
      const example = { example: errors.email.example };
      const at = trimmed.indexOf(EMAIL_AT);
      if (count === 0) return fillCopy(errors.email.empty, example);
      if (at < 0) return fillCopy(errors.email.missingAt, example);
      if (!EMAIL_DOMAIN_PATTERN.test(trimmed.slice(at + 1))) {
        return fillCopy(errors.email.missingDomain, example);
      }
      return fillCopy(errors.email.invalid, example);
    }
    return fillCopy(
      count < CONTACT_LIMITS.messageMin ? errors.message.tooShort : errors.message.tooLong,
      limits,
    );
  })();
  return `${FIELD_ERROR_PREFIX}${text}`;
}

const UNKNOWN_TIME = '--:--';
const UNKNOWN_ZONE_CODE = '---';

export function timezonePlaceholderRows(
  labels: { erikLabel: string; youLabel: string },
  erikCode: string,
): readonly string[] {
  return [
    `${fillCopy(labels.erikLabel, { code: erikCode })} ${UNKNOWN_TIME}`,
    `${fillCopy(labels.youLabel, { code: UNKNOWN_ZONE_CODE })} ${UNKNOWN_TIME}`,
  ];
}
