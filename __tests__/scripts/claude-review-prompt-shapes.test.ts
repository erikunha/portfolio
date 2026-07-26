import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { extractReviewedSha, parseClaudeVerdict } from '@/scripts/check-claude-approval';

const WORKFLOW = join(process.cwd(), '.github', 'workflows', 'claude-review.yml');

const HEAD_SHA = 'bb390ab1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7';

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

describe('the claude-review prompt instructs shapes the merge gate can parse', () => {
  it.each([
    ['Approve', 'approve'],
    ['Approve with minor changes', 'approve'],
    ['Request changes', 'request-changes'],
    ['Reject', 'reject'],
  ])('the instructed verdict shape for %s parses as %s', (word, expected) => {
    expect(parseClaudeVerdict(`**Verdict: ${word}.**`)).toBe(expected);
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

  it.each([
    [`Reviewed against commit \`${HEAD_SHA}\`.`, 'the word head never appears'],
    [`Reviewed at head commit ${HEAD_SHA}.`, 'the SHA carries no backticks'],
    [
      `Reviewed at the head commit of this pull request, \`${HEAD_SHA}\`.`,
      'more than 24 characters separate head from the backtick',
    ],
  ])('the near-miss %s extracts no SHA (%s)', (body) => {
    expect(extractReviewedSha(body)).toBeNull();
  });

  it('the prompt still instructs the bold verdict shape', () => {
    expect(systemPrompt()).toContain('**Verdict: Approve.**');
  });

  it('the prompt still instructs the backticked head-SHA shape', () => {
    expect(systemPrompt()).toContain('Reviewed at head commit');
  });

  it('the prompt states the 24-character bound the extractor actually enforces', () => {
    expect(systemPrompt()).toMatch(/within 24 characters/);
  });
});
