import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { SocialSchema } from '@/content/schemas';
import { HIRING_PROFILE, HiringProfileSchema } from '@/lib/hiring-profile';
import { productionSources } from '../helpers/production-sources';

const SCANNED_ROOTS = ['app', 'components', 'content', 'design-system', 'lib', 'scripts'];
const CHAIN_ARGS = String.raw`\((?:[^()]|\([^()]*\))*\)`;
const DEPRECATED_STRING_FORMAT = new RegExp(
  String.raw`\bz\s*\.string\(\)(?:\s*\.\w+${CHAIN_ARGS})*?\s*\.(url|email|uuid)\(`,
  'g',
);

function deprecatedFormats(source: string): string[] {
  return [...source.matchAll(DEPRECATED_STRING_FORMAT)].map((match) => match[1] ?? '');
}

const URLS = [
  'https://erikunha.dev',
  'https://erikunha.dev/path?q=1#h',
  'http://localhost:3000',
  'mailto:hello@erikunha.dev',
  'https://user:pw@host.example/p',
  'ftp://files.example.com',
  'javascript:alert(1)',
  '  https://padded.example  ',
  'HTTPS://UPPER.EXAMPLE',
  '',
  'not a url',
  '/relative/path',
  '//protocol-relative.example',
  'https://',
  'http//missing-colon.example',
];
const EMAILS = [
  'hello@erikunha.dev',
  'a+tag@sub.example.co',
  'first.last@example.com',
  'a@b',
  '',
  'plain',
  'a@',
  '@b.co',
  'a b@example.com',
  'a@@example.com',
];
const UUIDS = [
  '00000000-0000-4000-8000-000000000000',
  '3F2504E0-4F89-41D3-9A0C-0305E82C3301',
  '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  '00000000-0000-0000-0000-000000000000',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  '3f2504e0-4f89-01d3-9a0c-0305e82c3301',
  '3f2504e0-4f89-41d3-ca0c-0305e82c3301',
  '3f2504e04f8941d39a0c0305e82c3301',
  '',
  'not-a-uuid',
];

const verdicts = (schema: z.ZodType, inputs: readonly string[]) =>
  inputs.map((input) => {
    const result = schema.safeParse(input);
    return result.success ? { ok: true, value: result.data } : { ok: false };
  });

describe('Zod 4 top-level string formats keep the acceptance of the deprecated chains', () => {
  it('z.url() accepts and rejects exactly what z.string().url() did', () => {
    expect(verdicts(z.url(), URLS)).toEqual(verdicts(z.string().url(), URLS));
  });

  it('z.url() keeps the https prefix check composable', () => {
    expect(verdicts(z.url().startsWith('https://'), URLS)).toEqual(
      verdicts(z.string().url().startsWith('https://'), URLS),
    );
  });

  it('z.email() accepts and rejects exactly what z.string().email() did', () => {
    expect(verdicts(z.email(), EMAILS)).toEqual(verdicts(z.string().email(), EMAILS));
  });

  it('z.uuid().toLowerCase() accepts, rejects and normalizes like the chain it replaces', () => {
    expect(verdicts(z.uuid().toLowerCase(), UUIDS)).toEqual(
      verdicts(z.string().uuid().toLowerCase(), UUIDS),
    );
  });

  it('pins the inputs the site depends on', () => {
    expect(z.url().safeParse('https://erikunha.dev').success).toBe(true);
    expect(z.url().safeParse('mailto:hello@erikunha.dev').success).toBe(true);
    expect(z.url().safeParse('/relative').success).toBe(false);
    expect(z.url().safeParse('').success).toBe(false);
    expect(z.email().safeParse('hello@erikunha.dev').success).toBe(true);
    expect(z.email().safeParse('plain').success).toBe(false);
    expect(z.uuid().toLowerCase().parse('3F2504E0-4F89-41D3-9A0C-0305E82C3301')).toBe(
      '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    );
    expect(z.uuid().safeParse('3f2504e04f8941d39a0c0305e82c3301').success).toBe(false);
  });
});

describe('the shipped schemas that use those formats', () => {
  const social = {
    github: 'https://github.com/erikunha',
    githubLabel: 'github',
    linkedin: 'https://linkedin.com/in/erikunha',
    linkedinLabel: 'linkedin',
    email: 'hello@erikunha.dev',
    site: 'https://erikunha.dev',
    siteLabel: 'erikunha.dev',
    handle: 'erikunha',
    whatsapp: 'https://wa.me/5500000000000',
  };

  it('SocialSchema takes valid links and rejects a malformed url or email', () => {
    expect(SocialSchema.safeParse(social).success).toBe(true);
    expect(SocialSchema.safeParse({ ...social, github: 'github' }).success).toBe(false);
    expect(SocialSchema.safeParse({ ...social, site: '/relative' }).success).toBe(false);
    expect(SocialSchema.safeParse({ ...social, email: 'plain' }).success).toBe(false);
    expect(SocialSchema.safeParse({ ...social, whatsapp: '' }).success).toBe(false);
  });

  it('HiringProfileSchema takes the shipped profile and rejects a malformed url or email', () => {
    expect(HiringProfileSchema.safeParse(HIRING_PROFILE).success).toBe(true);
    expect(HiringProfileSchema.safeParse({ ...HIRING_PROFILE, url: 'x' }).success).toBe(false);
    expect(HiringProfileSchema.safeParse({ ...HIRING_PROFILE, email: 'x' }).success).toBe(false);
    expect(HiringProfileSchema.safeParse({ ...HIRING_PROFILE, github: '' }).success).toBe(false);
    expect(HiringProfileSchema.safeParse({ ...HIRING_PROFILE, linkedin: '/in' }).success).toBe(
      false,
    );
  });
});

describe('no source uses the deprecated z.string() format chains', () => {
  it('the scanner flags the deprecated forms', () => {
    expect(deprecatedFormats('z.string().url()')).toEqual(['url']);
    expect(deprecatedFormats('z.string().email()')).toEqual(['email']);
    expect(deprecatedFormats('z.string().uuid().toLowerCase()')).toEqual(['uuid']);
    expect(deprecatedFormats('z.string().min(1).url()')).toEqual(['url']);
    expect(deprecatedFormats('z.string().trim().max(10).email()')).toEqual(['email']);
    expect(deprecatedFormats('z\n  .string()\n  .min(1)\n  .url()')).toEqual(['url']);
    expect(deprecatedFormats('z.string().regex(/(a)/).uuid()')).toEqual(['uuid']);
  });

  it('the scanner passes the Zod 4 forms and unrelated chains', () => {
    expect(deprecatedFormats('z.url()')).toEqual([]);
    expect(deprecatedFormats('z.email().min(1)')).toEqual([]);
    expect(deprecatedFormats('z.uuid().toLowerCase()')).toEqual([]);
    expect(deprecatedFormats('z.url().startsWith("https://")')).toEqual([]);
    expect(deprecatedFormats('{ a: z.string(), b: z.url() }')).toEqual([]);
    expect(deprecatedFormats('z.string().min(1)')).toEqual([]);
    expect(deprecatedFormats('z.string(),\n  link: z.url()')).toEqual([]);
  });

  it('production sources hold none', () => {
    const offenders: string[] = [];
    for (const [file, text] of productionSources(SCANNED_ROOTS)) {
      for (const format of deprecatedFormats(text)) {
        offenders.push(`${file}: z.string()...${format}() is deprecated, use z.${format}()`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
