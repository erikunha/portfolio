import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  extractReviewedSha,
  HEAD_SHA_GAP_MAX,
  parseClaudeVerdict,
} from '@/scripts/check-claude-approval';

const WORKFLOW = join(process.cwd(), '.github', 'workflows', 'claude-review.yml');

const HEAD_SHA = 'bb390ab1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7';

const EXPECTED_VERDICT = new Map([
  ['approve', 'approve'],
  ['approve with minor changes', 'approve'],
  ['request changes', 'request-changes'],
  ['reject', 'reject'],
]);

type Step = { with?: { claude_args?: unknown } };

function systemPrompt(): string {
  const doc = parse(readFileSync(WORKFLOW, 'utf8')) as {
    jobs?: { review?: { steps?: Step[] } };
  };
  const args = doc.jobs?.review?.steps?.find((s) => typeof s.with?.claude_args === 'string')?.with
    ?.claude_args;
  if (typeof args !== 'string') {
    throw new Error(
      'claude-review.yml has no step carrying a claude_args string. That string holds the reviewer system prompt, and this suite is the only gate binding the shapes it instructs to the parsers that read them. If the wiring moved, point this helper at the new location; do not delete this test.',
    );
  }
  return args;
}

function instructedVerdictWords(): string[] {
  const list = systemPrompt().match(/substituting one of ([^.]+)\./)?.[1];
  if (!list) {
    throw new Error(
      'claude-review.yml no longer instructs its verdict words with "substituting one of <list>." This suite reads that list out of the prompt on purpose: a hardcoded copy stays green when the prompt renames a verdict, and a renamed rejection word that still contains "approve" makes parseClaudeVerdict clear a rejected PR. Re-point this matcher at the new phrasing; do not inline the words.',
    );
  }
  return list
    .split(/,| or /)
    .map((w) => w.trim())
    .filter(Boolean);
}

describe('the claude-review prompt instructs shapes the merge gate can parse', () => {
  it('every verdict word the prompt instructs parses to the verdict it names', () => {
    const words = instructedVerdictWords();
    expect(words.length).toBeGreaterThan(0);
    for (const word of words) {
      const expected = EXPECTED_VERDICT.get(word.toLowerCase());
      expect(
        expected,
        `the prompt instructs the verdict word "${word}", which this suite has no expected parse for. Add it to EXPECTED_VERDICT with the ClaudeVerdict it must produce, and check parseClaudeVerdict actually yields that: a new word containing "approve" resolves to approve no matter what it means.`,
      ).toBeDefined();
      expect(parseClaudeVerdict(`**Verdict: ${word}.**`)).toBe(expected);
    }
  });

  it.each([
    ['**Verdict:** Approve', 'the label is bold but the verdict word is outside the span'],
    ['Verdict: Approve', 'nothing is bold'],
    ['> Approve', 'no emphasis at all'],
  ])('the near-miss %s reads as no verdict (%s)', (body) => {
    expect(parseClaudeVerdict(body)).toBe('none');
  });

  it('the instructed head-SHA shape yields the SHA', () => {
    expect(extractReviewedSha(`Reviewed at head commit \`${HEAD_SHA}\`.`)).toBe(HEAD_SHA);
  });

  it('a gap of exactly HEAD_SHA_GAP_MAX still extracts, and one more does not', () => {
    const gap = (n: number) => `head${' '.repeat(n)}\`${HEAD_SHA}\``;
    expect(extractReviewedSha(gap(HEAD_SHA_GAP_MAX))).toBe(HEAD_SHA);
    expect(extractReviewedSha(gap(HEAD_SHA_GAP_MAX + 1))).toBeNull();
  });

  it.each([
    [`Reviewed against commit \`${HEAD_SHA}\`.`, 'the word head never appears'],
    [`Reviewed at head commit ${HEAD_SHA}.`, 'the SHA carries no backticks'],
  ])('the near-miss %s extracts no SHA (%s)', (body) => {
    expect(extractReviewedSha(body)).toBeNull();
  });

  it('the prompt still instructs the bold verdict shape', () => {
    expect(systemPrompt()).toContain('**Verdict: Approve.**');
  });

  it('the prompt still instructs the backticked head-SHA shape', () => {
    expect(systemPrompt()).toContain('Reviewed at head commit');
  });

  it('the prompt states the gap bound the extractor actually enforces', () => {
    expect(systemPrompt()).toContain(`within ${HEAD_SHA_GAP_MAX} characters`);
  });
});
