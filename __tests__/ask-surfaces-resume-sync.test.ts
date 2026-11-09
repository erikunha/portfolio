import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASK_EVAL_CALIBRATION } from '@/content/ask-eval-calibration';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import { education } from '@/content/education';
import { RAYLU_OWNED_SCOPE } from '@/content/profile';
import { cvDocument } from '@/content/reading-views';
import { SITE_LOCALE } from '@/content/site-locale';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';

const ROOT = path.resolve(__dirname, '..');
const CURRENT_ROLE_SECTION = /## Current role[\s\S]*?(?=\n## )/;
const WHOLE_PLATFORM_GUARD = 'Do NOT widen this to whole-platform ownership';
const RETIRED_RAYLU_SCOPE = [
  'second engineer',
  'primary since August',
  'market maps',
  'target lists',
  'diligence views',
  'RFC-driven',
  'shared UI systems',
];
const NON_ENTITY_WORDS = new Set([
  'Identifies',
  'States',
  'Toward',
  'Yes',
  'Early',
  'Based',
  'Should',
  'June',
  'Portuguese',
  'Spanish',
  'French',
]);
const ENTITY_PATTERN = /[A-Z][A-Za-z.+#]{2,}|\d[\d.,]*[+%BMKx]?/g;
const CORPUS_COUNT_PATTERN = /\b\d+[\s-]*(?:case|item|question|prompt|gold)s?\b/i;
const CORPUS_CONTEXT_PATTERN = /corpus|eval|calibrat/i;
const COUNT_PROXIMITY_CHARS = 80;

const currentRole = SYSTEM_TEXT.match(CURRENT_ROLE_SECTION)?.[0] ?? '';

const publishedTextSurfaces = (): Array<[string, string]> => {
  const contentDir = path.join(ROOT, 'content');
  const content = readdirSync(contentDir)
    .filter(
      (file) => file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.startsWith('ask-eval-'),
    )
    .map((file): [string, string] => [
      `content/${file}`,
      readFileSync(path.join(contentDir, file), 'utf8'),
    ]);
  return [
    ...content,
    ['public/llms.txt', readFileSync(path.join(ROOT, 'public/llms.txt'), 'utf8')],
    [
      'public/.well-known/agent.json',
      readFileSync(path.join(ROOT, 'public/.well-known/agent.json'), 'utf8'),
    ],
    ['lib/ask/system-prompt.ts', SYSTEM_TEXT],
  ];
};

describe('the ask prompt states the Raylu scope the CV states', () => {
  it('claims the frontend-platform ownership the CV summary claims, and nothing wider', () => {
    expect(
      cvDocument[SITE_LOCALE.en].summary,
      'the CV summary no longer says Erik owns this scope: update RAYLU_OWNED_SCOPE and the prompt together',
    ).toContain(`own ${RAYLU_OWNED_SCOPE}`);
    expect(
      currentRole,
      'the Current role section must state the ownership the CV states, or the ask answer contradicts the page it sits on',
    ).toContain(RAYLU_OWNED_SCOPE);
    expect(currentRole).toContain(WHOLE_PLATFORM_GUARD);
  });

  it('carries no Raylu scope claim the content does not hold', () => {
    for (const phrase of RETIRED_RAYLU_SCOPE) {
      expect(
        SYSTEM_TEXT,
        `"${phrase}" is a retired Raylu scope claim: the resume in content/ no longer says it, so the ask answer would contradict /cv`,
      ).not.toContain(phrase);
      expect(
        JSON.stringify(ASK_EVAL_CALIBRATION),
        `calibration still says "${phrase}"`,
      ).not.toContain(phrase);
      expect(JSON.stringify(ASK_EVAL_CORPUS), `corpus still says "${phrase}"`).not.toContain(
        phrase,
      );
    }
  });
});

describe('the ask eval corpus grades only what the prompt can answer', () => {
  it('names no entity or figure in a factual expectation that the system prompt lacks', () => {
    const prompt = SYSTEM_TEXT.toLowerCase();
    const ungrounded = ASK_EVAL_CORPUS.filter((item) => item.kind === 'factual').flatMap((item) =>
      (item.expect.match(ENTITY_PATTERN) ?? [])
        .map((token) => token.replace(/[.,]$/, ''))
        .filter((token) => !NON_ENTITY_WORDS.has(token) && !prompt.includes(token.toLowerCase()))
        .map((token) => `${item.id}: ${token}`),
    );
    expect(
      ungrounded,
      'a factual expectation names something the system prompt does not state, so the judge scores the model against a fact it cannot know',
    ).toEqual([]);
  });

  it('describes the consulting work, Nike and the Canadian diploma as content/ does', () => {
    const expectOf = (id: string) => ASK_EVAL_CORPUS.find((item) => item.id === id)?.expect ?? '';
    const coOp = education[SITE_LOCALE.en].find((entry) => entry.id === 'CO_OP_DIPLOMA');
    expect(expectOf('fact-independent-consulting')).toContain(
      'hospital equipment service platform',
    );
    expect(SYSTEM_TEXT).toContain('hospital equipment service platform');
    expect(expectOf('fact-nike-centauro')).toContain('BFF gateway');
    expect(SYSTEM_TEXT).toContain('BFF gateway');
    expect(expectOf('fact-canada-status')).toContain(coOp?.degree ?? 'missing degree');
  });
});

describe('public text surfaces publish no eval corpus size', () => {
  it('states no count of corpus, eval or calibration cases that a gate does not hold', () => {
    const offenders = publishedTextSurfaces().filter(([, text]) =>
      [...text.matchAll(new RegExp(CORPUS_COUNT_PATTERN, 'gi'))].some((match) => {
        const start = Math.max(0, (match.index ?? 0) - COUNT_PROXIMITY_CHARS);
        const end = (match.index ?? 0) + match[0].length + COUNT_PROXIMITY_CHARS;
        return CORPUS_CONTEXT_PATTERN.test(text.slice(start, end));
      }),
    );
    expect(
      offenders.map(([surface]) => surface),
      'the corpus grows with every guard that ships, so a published size goes stale; no gate holds one',
    ).toEqual([]);
  });
});

describe('llms.txt describes the consulting work as content/ does', () => {
  it('names the hospital equipment service platform, not hospital operations', () => {
    const llms = readFileSync(path.join(ROOT, 'public/llms.txt'), 'utf8');
    const imaging =
      llms.split('\n').find((line) => line.startsWith('- Medical imaging equipment:')) ?? '';
    expect(imaging).toContain('hospital equipment service');
    expect(llms).not.toMatch(/hospital operations/i);
  });
});
