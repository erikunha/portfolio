// Behavioral test for the claude-review merge gate's pure parsing logic
// (scripts/check-claude-approval.ts). The gh I/O orchestration in run() is not
// unit-tested (it shells out, like the old copilot gate); what CAN break is the
// verdict/SHA parsing of claude[bot]'s overview comment, so that is what we pin.
//
// Verdict formats are taken from real claude-review overviews observed on this
// repo's PRs (#152 "(head `sha`)", #153 "Reviewed at HEAD `sha`", #154
// "Reviewed at head commit `sha`."), so the gate survives the format variance.

import { describe, expect, it } from 'vitest';
import { extractReviewedSha, parseClaudeVerdict } from '@/scripts/check-claude-approval';

describe('parseClaudeVerdict', () => {
  it('reads a plain Approve verdict', () => {
    expect(parseClaudeVerdict('Looks good.\n\n**Approve.**')).toBe('approve');
  });

  it('reads Approve with minor changes as approve (non-blocking minors)', () => {
    expect(parseClaudeVerdict('One nit.\n\n**Approve with minor changes.**')).toBe('approve');
  });

  it('reads a "Verdict: Approve" prefixed form', () => {
    expect(parseClaudeVerdict('Summary…\n\n**Verdict: Approve.**')).toBe('approve');
  });

  it('reads Request changes', () => {
    expect(parseClaudeVerdict('Two issues.\n\n**Request changes.**')).toBe('request-changes');
  });

  it('reads Reject', () => {
    expect(parseClaudeVerdict('Fundamentally unsound.\n\n**Reject.**')).toBe('reject');
  });

  it('returns request-changes when both prose-mentions and a bold Request-changes verdict appear (verdict wins, not prose)', () => {
    const body = 'A reviewer might approve a smaller change, but here:\n\n**Request changes.**';
    expect(parseClaudeVerdict(body)).toBe('request-changes');
  });

  it('returns none for an in-progress comment with no verdict yet', () => {
    expect(parseClaudeVerdict('**Claude is working…**\n- [ ] Post overview')).toBe('none');
  });

  it('returns none for empty / non-verdict prose', () => {
    expect(parseClaudeVerdict('')).toBe('none');
    expect(parseClaudeVerdict('the code should approve the request eventually')).toBe('none');
  });
});

describe('extractReviewedSha', () => {
  it('extracts from the "Reviewed at head commit `sha`." form (#154)', () => {
    const sha = 'bb390ab172aee6735d4c5200a92be6513dbb8767';
    expect(extractReviewedSha(`Reviewed at head commit \`${sha}\`.`)).toBe(sha);
  });

  it('extracts from the "Reviewed at HEAD `sha`." short form (#153)', () => {
    expect(extractReviewedSha('Reviewed at HEAD `e39ad73`.')).toBe('e39ad73');
  });

  it('extracts from the "(head `sha`)" parenthetical form (#152)', () => {
    const sha = 'c87e1a26f04343d27fe0c7843679813b837e47c7';
    expect(extractReviewedSha(`This PR (head \`${sha}\`) does X.`)).toBe(sha);
  });

  it('returns null when no head SHA is present', () => {
    expect(extractReviewedSha('Approve. No commit reference here.')).toBeNull();
  });
});
