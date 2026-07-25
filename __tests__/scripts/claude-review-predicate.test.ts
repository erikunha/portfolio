import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WORKFLOW = join(process.cwd(), '.github', 'workflows', 'claude-review.yml');

function block(source: string, startKey: string, endKey: string): string {
  const from = source.indexOf(startKey);
  const to = source.indexOf(endKey, from);
  return source
    .slice(from + startKey.length, to)
    .replace(/\s+/g, ' ')
    .trim();
}

describe('claude-review concurrency group mirrors the job condition', () => {
  const source = readFileSync(WORKFLOW, 'utf8');
  const group = block(source, 'group: >-', 'cancel-in-progress:');
  const jobIf = block(source, 'if: >-', 'runs-on:');

  it('the group admits exactly what the job admits', () => {
    expect(
      group.includes(jobIf),
      `The concurrency group predicate no longer contains the job's \`if:\` predicate verbatim.\n\nThese two MUST stay identical. GitHub resolves concurrency at the RUN level, before \`if:\` is evaluated, so any run the group admits but the job skips still takes a slot and — with cancel-in-progress on — kills a live review while posting nothing. That is how PR #221 was left with no verdict.\n\nConcurrency cannot read \`env\` or a job output, so the duplication is forced by the platform and this assertion is the only thing holding the two copies together.\n\ngroup: ${group}\n\nif:    ${jobIf}`,
    ).toBe(true);
  });

  it('the draft check stays guarded by the event name', () => {
    // GHA casts null to false, so an unguarded `draft == false` evaluates TRUE
    // on a comment event and would admit every comment into the review group.
    for (const [label, expr] of [
      ['group', group],
      ['if', jobIf],
    ] as const) {
      const guard = expr.indexOf("github.event_name == 'pull_request'");
      const draft = expr.indexOf('draft == false');
      expect(guard, `${label}: event_name guard missing`).toBeGreaterThanOrEqual(0);
      expect(draft, `${label}: draft check missing`).toBeGreaterThanOrEqual(0);
      expect(
        guard < draft,
        `${label}: the event_name guard must precede \`draft == false\`, or a comment event admits itself.`,
      ).toBe(true);
    }
  });

  it('a run the job would skip cannot share the review group', () => {
    expect(
      group.includes("format('claude-review-noop-{0}', github.run_id)"),
      'Non-qualifying runs must fall into a per-run group they share with nothing.',
    ).toBe(true);
  });
});
