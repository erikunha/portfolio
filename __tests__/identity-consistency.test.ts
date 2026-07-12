import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { heroTagline } from '@/content/hero';
import { personSchema } from '@/content/seo';
import { social } from '@/content/social';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';
import { HIRING_PROFILE } from '@/lib/hiring-profile';

vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--font-mock', className: 'mock' }),
}));

const CANONICAL_TITLE = 'Senior Full-Stack Engineer';
const RETIRED_TITLE = 'Full-Stack Software Engineer';

const llmsTxt = readFileSync(path.resolve(__dirname, '../public/llms.txt'), 'utf-8');
const agentManifest = readFileSync(
  path.resolve(__dirname, '../public/.well-known/agent.json'),
  'utf-8',
);
// behavioral-test-allow: the OG-image title is baked into an HTML template string inside the
// generator script, so it is reachable only as source text — there is nothing to import
const ogImageScript = readFileSync(
  path.resolve(__dirname, '../scripts/generate-og-image.ts'),
  'utf-8',
);
const digitsOf = (value: string) => value.replace(/\D/g, '');

let layoutTitle = '';
let layoutMetadataText = '';

beforeAll(async () => {
  const { metadata } = await import('@/app/layout');
  layoutTitle = String(metadata.title);
  // every metadata field a crawler or link-unfurler reads: title, description,
  // openGraph.{title,description,images[].alt}, twitter.{title,description}
  layoutMetadataText = JSON.stringify(metadata);
});

describe('identity is consistent across every public surface', () => {
  it('every title surface states the canonical title', () => {
    const surfaces: Array<[string, string]> = [
      ['content/hero.ts (heroTagline)', heroTagline],
      ['content/seo.ts (jobTitle)', personSchema.jobTitle],
      ['app/layout.tsx (metadata.title)', layoutTitle],
      ['public/llms.txt', llmsTxt],
      ['scripts/generate-og-image.ts (social preview card)', ogImageScript],
    ];
    const drifted = surfaces.filter(([, text]) => !text.includes(CANONICAL_TITLE)).map(([s]) => s);

    expect(
      drifted,
      `these surfaces do not state the canonical title "${CANONICAL_TITLE}". Every surface a recruiter or crawler can land on must agree. These strings are Zod-validated for SHAPE (min length), never for VALUE, so nothing stopped them drifting apart — which is exactly how public/llms.txt ended up naming a stale employer while the JSON-LD named the current one.`,
    ).toEqual([]);
  });

  it('no surface still carries the retired title', () => {
    const surfaces: Array<[string, string]> = [
      ['content/hero.ts (heroTagline)', heroTagline],
      ['content/seo.ts (jobTitle)', personSchema.jobTitle],
      ['content/seo.ts (hasOccupation.name)', personSchema.hasOccupation.name],
      ['content/seo.ts (description)', personSchema.description],
      ['app/layout.tsx (all metadata: og + twitter + alt + description)', layoutMetadataText],
      ['lib/hiring-profile.ts (served at /api/erik.json)', JSON.stringify(HIRING_PROFILE)],
      ['public/llms.txt', llmsTxt],
      ['public/.well-known/agent.json', agentManifest],
      ['scripts/generate-og-image.ts (social preview card)', ogImageScript],
      ['lib/ask/system-prompt.ts', SYSTEM_TEXT],
    ];
    const stale = surfaces.filter(([, text]) => text.includes(RETIRED_TITLE)).map(([s]) => s);

    expect(
      stale,
      `"${RETIRED_TITLE}" was retired in favour of "${CANONICAL_TITLE}" (owner decision). A half-normalized identity is the defect: it reads differently depending on where the reader lands.`,
    ).toEqual([]);
  });

  it('the phone number is identical across the JSON-LD, the wa.me link, and llms.txt', () => {
    const canonical = digitsOf(personSchema.telephone);

    expect(
      digitsOf(social.whatsapp.split('/').pop() ?? ''),
      'the wa.me deep link must carry the same digits as the JSON-LD telephone. A wa.me link with the wrong digits silently resolves to nothing, or to a stranger.',
    ).toBe(canonical);

    expect(
      llmsTxt.includes(personSchema.telephone),
      `public/llms.txt must publish the same number as the JSON-LD (${personSchema.telephone}). This is the surface built for crawlers and LLMs; a wrong number here is machine-readable and gets dialled.`,
    ).toBe(true);
  });
});
