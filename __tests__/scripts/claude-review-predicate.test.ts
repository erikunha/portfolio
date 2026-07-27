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

// Splits a GHA `if:` on its TOP-LEVEL `||` only, so a fence can be asserted
// against the branch that needs it rather than against the whole expression.
// Nested `||` inside a parenthesised sub-expression stays with its branch.
function splitTopLevelOr(expr: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && c === '|' && expr[i + 1] === '|') {
      out.push(expr.slice(start, i).trim());
      start = i + 2;
      i++;
    }
  }
  out.push(expr.slice(start).trim());
  return out.filter(Boolean);
}

describe('pull_request_target is fenced to trusted authors on a public repo', () => {
  const doc = workflow();

  it('the auto path admits only OWNER, MEMBER or COLLABORATOR', () => {
    // Asserted on the pull_request_target DISJUNCT IN ISOLATION. Scanning the
    // whole `if:` is satisfied by the issue_comment branch, which has always
    // carried author_association and all three role literals — so deleting the
    // fence from the auto branch left every assertion green while any fork PR on
    // this PUBLIC repo could run a job holding the repo token.
    const jobIf = collapse(String(at(doc, ['jobs', 'review', 'if'])));
    const branches = splitTopLevelOr(jobIf);
    const auto = branches.find((b) => b.includes('pull_request_target'));
    expect(
      auto,
      `No top-level disjunct of the review job's \`if:\` mentions pull_request_target. If the trigger moved, re-derive this fence for it; do not delete it.\n\nif: ${jobIf}`,
    ).toBeTruthy();
    expect(
      auto,
      `The pull_request_target branch does not fence on github.event.pull_request.author_association. pull_request_target hands the job the repo token for FORK PRs, unlike pull_request which gives them nothing, and this repo is public.\n\nbranch: ${auto}`,
    ).toContain('github.event.pull_request.author_association');
    expect(
      auto,
      `The auto branch's allow-list is not exactly OWNER/MEMBER/COLLABORATOR. Widening it (CONTRIBUTOR, say) admits anyone who has ever landed a commit.\n\nbranch: ${auto}`,
    ).toContain(`fromJSON('["OWNER","MEMBER","COLLABORATOR"]')`);
  });

  it('the reviewer prompt is never read from the checked-out workspace', () => {
    // Under pull_request_target the workspace holds PR-authored content, and the
    // server-side check validates only the WORKFLOW file — the prompt stopped
    // living there on 2026-07-26. Three things must hold together; asserting the
    // `git show` string alone was not enough, because retargeting the FETCH to
    // the PR ref leaves that string untouched and makes the prompt PR-authored.
    const yml = readFileSync(WORKFLOW, 'utf8');
    const steps = (doc.jobs as { review?: { steps?: Array<Record<string, unknown>> } })?.review
      ?.steps;
    if (!Array.isArray(steps))
      throw new Error('claude-review.yml: jobs.review.steps is not an array');

    const args = String(
      (steps as Array<{ with?: { claude_args?: string } }>).find(
        (st) => typeof st.with?.claude_args === 'string',
      )?.with?.claude_args,
    );
    expect(
      /--append-system-prompt-file\s+\.github\//.test(args),
      'The prompt is loaded straight from the workspace path. A PR can write anything into .github/ in its own head.',
    ).toBe(false);

    // 1. the fetch is pinned to the DEFAULT BRANCH, not to any PR-controlled ref
    expect(
      yml.includes('git fetch --depth=1 origin "$DEFAULT_BRANCH"') &&
        yml.includes('DEFAULT_BRANCH: ${{ github.event.repository.default_branch }}'),
      'The prompt fetch is no longer pinned to github.event.repository.default_branch. Retargeting it at the PR ref keeps the `git show` line intact while handing prompt authorship to the PR.',
    ).toBe(true);

    // 2. it is git show of that fetch, not a workspace read
    expect(
      yml.includes('git show "FETCH_HEAD:.github/claude-review-prompt.md"'),
      'The default-branch materialisation is gone, so whatever the prompt flag points at is no longer provably trusted.',
    ).toBe(true);

    // 3. it happens BEFORE the action, or the action loads a stale or absent file
    const materialiseAt = steps.findIndex((st) =>
      String(st.name ?? '').includes('Materialise the trusted reviewer prompt'),
    );
    const actionAt = steps.findIndex((st) => String(st.uses ?? '').includes('claude-code-action'));
    expect(materialiseAt, 'the materialise step is missing').toBeGreaterThanOrEqual(0);
    expect(actionAt, 'the claude-code-action step is missing').toBeGreaterThanOrEqual(0);
    expect(
      materialiseAt < actionAt,
      `The prompt is materialised AFTER the reviewer runs (materialise=${materialiseAt}, action=${actionAt}), so the action loads a stale or absent /tmp file while both string assertions above still pass.`,
    ).toBe(true);
  });
});
