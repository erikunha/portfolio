import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const WORKFLOW = join(process.cwd(), '.github', 'workflows', 'claude-review.yml');

// Read as structured values, never by scanning text. Four successive versions of
// this gate extracted with indexOf and each was bypassed the same way: an anchor
// pins one coordinate (key present, which key, which job starts) and the next
// unpinned coordinate becomes the next bypass. A decoy job, a relocated
// concurrency block, or an `if:` spelled without `>-` all walked past a text
// scan while the gate stayed green. A parser has a notion of containment, so the
// class retires rather than moving up one level.
function workflow(): Record<string, unknown> {
  const doc = parse(readFileSync(WORKFLOW, 'utf8')) as Record<string, unknown>;
  if (!doc || typeof doc !== 'object')
    throw new Error('claude-review.yml did not parse to a mapping');
  return doc;
}

function at(doc: unknown, path: readonly string[]): string {
  let node: unknown = doc;
  for (const key of path) {
    if (!node || typeof node !== 'object') {
      throw new Error(
        `claude-review.yml: ${path.join('.')} is missing; this gate cannot find what it guards`,
      );
    }
    node = (node as Record<string, unknown>)[key];
  }
  if (typeof node !== 'string' || node.trim() === '') {
    throw new Error(`claude-review.yml: ${path.join('.')} is absent or not a string`);
  }
  return node.replace(/\s+/g, ' ').trim();
}

// The group is the job predicate wrapped in one paren layer, then routed to a
// per-PR key or an isolated per-run key. Equality against this template is the
// whole property: containment would pass while the group was broadened by an
// extra disjunct or inverted outright.
const groupFor = (predicate: string) =>
  `\${{ (${predicate}) && format('claude-review-{0}', github.event.pull_request.number || github.event.issue.number) || format('claude-review-noop-{0}', github.run_id) }}`;

describe('claude-review concurrency group mirrors the review job condition', () => {
  const doc = workflow();

  it('the group admits exactly what the review job admits, and routes the rest away', () => {
    const group = at(doc, ['concurrency', 'group']);
    const jobIf = at(doc, ['jobs', 'review', 'if']);
    expect(
      group,
      `The workflow-level concurrency group no longer equals the review job's \`if:\` wrapped in the routing template.\n\nGitHub resolves concurrency at the RUN level, before \`if:\` is evaluated, so any run the group admits but the job skips still takes a slot and — with cancel-in-progress on — kills a live review while posting nothing. That is how PR #221 was left with no verdict.\n\nConcurrency cannot read \`env\` or a job output, so the duplication is forced by the platform and this assertion is the only thing holding the two copies together.\n\nif:       ${jobIf}\nexpected: ${groupFor(jobIf)}\nactual:   ${group}`,
    ).toBe(groupFor(jobIf));
  });

  it('superseding is on, so a review of a stale HEAD cannot outlive the push that replaced it', () => {
    expect((doc.concurrency as Record<string, unknown>)['cancel-in-progress']).toBe(true);
  });
});
