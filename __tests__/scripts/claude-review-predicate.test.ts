import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WORKFLOW = join(process.cwd(), '.github', 'workflows', 'claude-review.yml');

function block(source: string, startKey: string, endKey: string): string {
  const from = source.indexOf(startKey);
  if (from === -1)
    throw new Error(
      `claude-review.yml: "${startKey}" not found; this gate cannot read the file it guards`,
    );
  const to = source.indexOf(endKey, from + startKey.length);
  if (to === -1) throw new Error(`claude-review.yml: "${endKey}" not found after "${startKey}"`);
  const text = source
    .slice(from + startKey.length, to)
    .replace(/\s+/g, ' ')
    .trim();
  if (text === '') throw new Error(`claude-review.yml: "${startKey}" block is empty`);
  return text;
}

// The group is the job predicate wrapped in one paren layer, then routed to a
// per-PR key or an isolated per-run key. Asserting equality against this
// template is the whole property: containment would let the group be broadened
// with an extra disjunct, or inverted outright, while still "containing" the
// job predicate.
const groupFor = (predicate: string) =>
  `\${{ (${predicate}) && format('claude-review-{0}', github.event.pull_request.number || github.event.issue.number) || format('claude-review-noop-{0}', github.run_id) }}`;

describe('claude-review concurrency group mirrors the job condition', () => {
  const source = readFileSync(WORKFLOW, 'utf8');
  const group = block(source, 'group: >-', 'cancel-in-progress:');
  const jobIf = block(source, 'if: >-', 'runs-on:');

  it('the group admits exactly what the job admits, and routes the rest away', () => {
    expect(
      group,
      `The concurrency group no longer equals the job's \`if:\` wrapped in the routing template.\n\nGitHub resolves concurrency at the RUN level, before \`if:\` is evaluated, so any run the group admits but the job skips still takes a slot and — with cancel-in-progress on — kills a live review while posting nothing. That is how PR #221 was left with no verdict.\n\nConcurrency cannot read \`env\` or a job output, so the duplication is forced by the platform and this assertion is the only thing holding the two copies together. Equality, not containment: containment would pass while the group was broadened by an extra disjunct or inverted outright.\n\nif:       ${jobIf}\nexpected: ${groupFor(jobIf)}\nactual:   ${group}`,
    ).toBe(groupFor(jobIf));
  });
});
