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

// Collapse whitespace only OUTSIDE quoted literals. Between tokens it is
// insignificant to the GHA expression parser; inside a literal it is not, and
// flattening it would let `'/claude review'` and `'/claude  review'` compare
// equal while admitting different runs. Odd indices are the quoted spans; GHA
// escapes an inner quote as '', which this split handles.
const collapse = (expr: string) =>
  expr
    .split(/('(?:[^']|'')*')/)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/\s+/g, ' ')))
    .join('')
    .trim();

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
  return collapse(node);
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
    const concurrency = doc.concurrency;
    if (!concurrency || typeof concurrency !== 'object') {
      throw new Error('claude-review.yml: the workflow-level `concurrency:` block is missing');
    }
    expect((concurrency as Record<string, unknown>)['cancel-in-progress']).toBe(true);
  });
});

describe('pull_request_target is fenced to trusted authors on a public repo', () => {
  const doc = workflow();

  it('the auto path admits only OWNER, MEMBER or COLLABORATOR', () => {
    // pull_request_target hands the job the repo token, INCLUDING for fork PRs —
    // the difference from pull_request, where a fork gets no secrets at all. This
    // repo is public, so without this gate any GitHub user could open a fork PR
    // and have a token-bearing job run against content they control. The comment
    // path has always carried the same fence; this asserts the auto path does too.
    const jobIf = String(at(doc, ['jobs', 'review', 'if']));
    expect(
      jobIf.includes('pull_request_target'),
      'The auto trigger is no longer pull_request_target. If it moved back to pull_request, every PR that edits this workflow becomes unreviewable again; if it moved to something else, re-derive this fence for that trigger.',
    ).toBe(true);
    expect(
      /author_association/.test(jobIf),
      `The pull_request_target branch no longer checks author_association. On a PUBLIC repo that lets an arbitrary fork PR run a job holding the repo token.\n\nif: ${jobIf}`,
    ).toBe(true);
    for (const role of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
      expect(jobIf, `the author fence dropped ${role}`).toContain(role);
    }
  });

  it('the reviewer prompt is never read from the checked-out workspace', () => {
    // Under pull_request_target the workspace holds PR-authored content. The
    // server-side workflow check validates only the workflow file, and the prompt
    // has not lived there since 2026-07-26 — so reading it from the workspace
    // would let a PR write the prompt its own reviewer runs on.
    const yml = readFileSync(WORKFLOW, 'utf8');
    const steps = (doc.jobs as { review?: { steps?: Array<{ with?: { claude_args?: string } }> } })
      ?.review?.steps;
    if (!Array.isArray(steps))
      throw new Error('claude-review.yml: jobs.review.steps is not an array');
    const args = String(
      steps.find((st) => typeof st.with?.claude_args === 'string')?.with?.claude_args,
    );
    expect(
      /--append-system-prompt-file\s+\.github\//.test(args),
      'The prompt is loaded straight from the workspace path. Materialise it from the default branch first; a PR can write anything into .github/ in its own head.',
    ).toBe(false);
    expect(
      yml.includes('git show "FETCH_HEAD:.github/claude-review-prompt.md"'),
      'The default-branch materialisation step is gone, so whatever the prompt flag points at is no longer provably trusted.',
    ).toBe(true);
  });
});
