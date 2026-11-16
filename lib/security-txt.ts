import { social } from '@/content/social';
import { EMAIL_ADDRESS } from '@/content/social-urls';

export const MIN_DAYS_LEFT = 30;
export const SECURITY_TXT_PATH = '/.well-known/security.txt';
export const PREFERRED_LANGUAGES = 'en, pt';

const MS_PER_DAY = 86_400_000;
const MAILTO = 'mailto:';
const HTTPS = 'https:';
const COMMENT_PREFIX = '#';
const FIELD_LINE = /^([A-Za-z][A-Za-z-]*):\s*(.+)$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const SITE_HOST = new URL(social.site).host;

export interface SecurityTxtReport {
  fields: Record<string, string[]>;
  problems: string[];
}

function single(fields: Record<string, string[]>, name: string, problems: string[]): string | null {
  const values = fields[name] ?? [];
  if (values.length === 1) return values[0] ?? null;
  problems.push(`${name}: expected exactly one, found ${values.length}`);
  return null;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function checkContacts(values: string[], problems: string[]): void {
  if (values.length === 0) problems.push('Contact: at least one is required');
  for (const value of values) {
    if (value.toLowerCase().startsWith(MAILTO)) {
      const address = value.slice(MAILTO.length).split('?')[0];
      if (address !== EMAIL_ADDRESS) problems.push(`Contact: ${value} is not ${EMAIL_ADDRESS}`);
    } else if (parseUrl(value)?.protocol !== HTTPS) {
      problems.push(`Contact: ${value} must be a mailto: or https: URI`);
    }
  }
}

function checkExpires(value: string | null, now: Date, problems: string[]): void {
  if (value === null) return;
  const time = ISO_UTC.test(value) ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(time)) {
    problems.push(`Expires: ${value} is not an ISO 8601 UTC date-time`);
    return;
  }
  const daysLeft = (time - now.getTime()) / MS_PER_DAY;
  if (daysLeft <= MIN_DAYS_LEFT) {
    problems.push(
      `Expires: ${value} leaves ${Math.floor(daysLeft)} days, need more than ${MIN_DAYS_LEFT} days`,
    );
  }
}

function checkCanonicals(values: string[], problems: string[]): void {
  if (values.length === 0) problems.push('Canonical: at least one is required');
  for (const value of values) {
    const url = parseUrl(value);
    const onSite =
      url?.protocol === HTTPS && url.host === SITE_HOST && url.pathname === SECURITY_TXT_PATH;
    if (!onSite)
      problems.push(`Canonical: ${value} must be https://${SITE_HOST}${SECURITY_TXT_PATH}`);
  }
}

function checkPolicies(values: string[], problems: string[]): void {
  if (values.length === 0) problems.push('Policy: at least one is required');
  for (const value of values) {
    if (parseUrl(value)?.protocol !== HTTPS)
      problems.push(`Policy: ${value} must be an https: URL`);
  }
}

export function parseSecurityTxt(text: string, now: Date): SecurityTxtReport {
  const fields: Record<string, string[]> = {};
  const problems: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith(COMMENT_PREFIX)) continue;
    const match = FIELD_LINE.exec(line);
    if (match?.[1] === undefined || match[2] === undefined) {
      problems.push(`line is not a field: ${line}`);
      continue;
    }
    const values = fields[match[1]] ?? [];
    values.push(match[2].trim());
    fields[match[1]] = values;
  }
  checkContacts(fields.Contact ?? [], problems);
  checkExpires(single(fields, 'Expires', problems), now, problems);
  checkCanonicals(fields.Canonical ?? [], problems);
  checkPolicies(fields.Policy ?? [], problems);
  const languages = single(fields, 'Preferred-Languages', problems);
  if (languages !== null && languages !== PREFERRED_LANGUAGES) {
    problems.push(`Preferred-Languages: ${languages} must be ${PREFERRED_LANGUAGES}`);
  }
  return { fields, problems };
}
