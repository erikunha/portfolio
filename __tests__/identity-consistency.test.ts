import { readdirSync, readFileSync } from 'node:fs';
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

const REPO_ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(REPO_ROOT, 'content');

const read = (relativePath: string) => readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');

const llmsTxt = read('public/llms.txt');
// behavioral-test-allow: the OG-image title is baked into an HTML template string inside the
// generator script, so it is reachable only as source text — there is nothing to import
const ogImageScript = read('scripts/generate-og-image.ts');

// Globbed, NOT hand-listed. A hand-maintained surface list leaked a survivor in three
// consecutive review rounds (the OG card, then the rendered man page, then the shell's
// whois response) because a new content file is only covered if someone remembers to add
// it. Enumerating the directory makes coverage the default and forgetting impossible.
const contentSurfaces: Array<[string, string]> = readdirSync(CONTENT_DIR)
  .filter((file) => file.endsWith('.ts'))
  .map((file) => [`content/${file}`, readFileSync(path.join(CONTENT_DIR, file), 'utf-8')]);

const digitsOf = (value: string) => value.replace(/\D/g, '');

let layoutMetadataText = '';

beforeAll(async () => {
  const { metadata } = await import('@/app/layout');
  layoutMetadataText = JSON.stringify(metadata);
});

describe('identity is consistent across every gated surface', () => {
  it('every title surface states the canonical title', () => {
    const surfaces: Array<[string, string]> = [
      ['content/hero.ts (heroTagline)', heroTagline],
      ['content/seo.ts (jobTitle)', personSchema.jobTitle],
      ['app/layout.tsx (metadata.title)', String(JSON.parse(layoutMetadataText).title)],
      ['public/llms.txt', llmsTxt],
      ['scripts/generate-og-image.ts (social preview card)', ogImageScript],
    ];
    const drifted = surfaces.filter(([, text]) => !text.includes(CANONICAL_TITLE)).map(([s]) => s);

    expect(
      drifted,
      `these surfaces do not state the canonical title "${CANONICAL_TITLE}". Every surface a recruiter or crawler lands on must agree. The content modules are Zod-validated for SHAPE (min length), never for VALUE, so nothing stopped them drifting apart — which is how public/llms.txt came to name a stale employer while the JSON-LD named the current one.`,
    ).toEqual([]);
  });

  it('no surface still carries the retired title', () => {
    const surfaces: Array<[string, string]> = [
      ...contentSurfaces,
      ['app/layout.tsx (og + twitter + alt + description)', layoutMetadataText],
      ['lib/hiring-profile.ts (served at /api/erik.json)', JSON.stringify(HIRING_PROFILE)],
      ['lib/ask/system-prompt.ts', SYSTEM_TEXT],
      ['public/llms.txt', llmsTxt],
      ['public/.well-known/agent.json', read('public/.well-known/agent.json')],
      ['scripts/generate-og-image.ts (social preview card)', ogImageScript],
    ];
    const needle = RETIRED_TITLE.toLowerCase();
    const stale = surfaces
      .filter(([, text]) => text.toLowerCase().includes(needle))
      .map(([s]) => s);

    expect(
      stale,
      `"${RETIRED_TITLE}" was retired in favour of "${CANONICAL_TITLE}" (owner decision). Matched case-INSENSITIVELY because content/man-page.ts carried it as lowercase prose and a case-sensitive check walked straight past it, on the one surface a human actually reads.\n\nNOT GATED HERE: public/erik-cunha-cv.pdf. Its text is in subset fonts with custom glyph encodings, so extracting it needs a real PDF parser (a dependency decision, not a test tweak). It is regenerated from the source .docx and verified by hand. If you change the title, regenerate the CV too — nothing here will catch it.`,
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
