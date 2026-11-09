import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import { projects } from '@/content/projects';
import { cvJsonLd } from '@/content/reading-views';
import { personSchema } from '@/content/seo';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';

const RETIRED = /clean architecture/i;
// behavioral-test-allow: llms.txt is a static public asset, the published text is the property under test
const llmsTxt = readFileSync(path.resolve(__dirname, '../public/llms.txt'), 'utf-8');

describe('retired claims stay out of every published surface', () => {
  it('no project, SEO keyword, eval answer or llms.txt line claims Clean Architecture', () => {
    const surfaces = {
      projects: JSON.stringify(projects),
      seo: JSON.stringify(personSchema),
      corpus: JSON.stringify(ASK_EVAL_CORPUS),
      cvJsonLd: JSON.stringify(cvJsonLd),
      askSystemPrompt: SYSTEM_TEXT,
      llmsTxt,
    };
    for (const [name, text] of Object.entries(surfaces)) {
      expect(
        text,
        `${name} must not mention Clean Architecture (owner retired the claim)`,
      ).not.toMatch(RETIRED);
    }
  });
});
