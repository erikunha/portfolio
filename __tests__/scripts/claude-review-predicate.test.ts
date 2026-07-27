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

  it('instruction-shaped files are stripped from the mounted PR copy before the action runs', () => {
    // `--add-dir pr-head` mounts PR-authored content as project scope, so a file
    // the CLI reads as instructions — CLAUDE.md, AGENTS.md, .claude/** — would
    // arrive on the INSTRUCTION channel rather than the data channel. Prose in
    // the appended prompt is not a mechanism; deleting the files is. The reviewer
    // still sees every one of them via `gh pr diff`, which is where a change to
    // them belongs under review.
    const steps = (
      doc.jobs as {
        review?: { steps?: Array<{ uses?: string; name?: string; run?: string }> };
      }
    )?.review?.steps;
    if (!Array.isArray(steps))
      throw new Error('claude-review.yml: jobs.review.steps is not an array');

    const stripAt = steps.findIndex((st) =>
      String(st.name ?? '').includes('Strip instruction-shaped'),
    );
    const actionAt = steps.findIndex((st) => String(st.uses ?? '').includes('claude-code-action'));
    const headAt = steps.findIndex(
      (st) => String(st.uses ?? '').includes('actions/checkout') && String(st.run ?? '') === '',
    );
    expect(
      stripAt,
      'the strip step is gone, so PR-authored instruction files reach the reviewer',
    ).toBeGreaterThanOrEqual(0);
    expect(
      stripAt < actionAt,
      `The strip runs AFTER the action (strip=${stripAt}, action=${actionAt}), so it removes nothing the reviewer had not already read.`,
    ).toBe(true);
    expect(headAt).toBeGreaterThanOrEqual(0);

    const run = String(steps[stripAt]?.run ?? '');
    for (const path of ['CLAUDE.md', 'AGENTS.md', '.claude', '.cursor']) {
      expect(
        run,
        `The strip no longer removes pr-head/${path}, which the CLI would ingest as project instructions authored by the PR under review.`,
      ).toContain(`pr-head/${path}`);
    }
    // It must VERIFY, not just rm: a typo'd path silently removes nothing.
    expect(
      /if \[ -e "pr-head\/\$p" \]/.test(run) && /exit 1/.test(run),
      'The strip does not verify its own result. A mistyped path would delete nothing and the step would still succeed.',
    ).toBe(true);
  });

  it('no untrusted ref is checked out at the workspace root', () => {
    // The action's own docs/security.md: "Do not check out an untrusted ref into
    // the workspace root before this action." The first version of this workflow
    // did, and the action died at `App token exchange failed: 401 Unauthorized -
    // Invalid OIDC token` on every run — it expects a git repo at the root and
    // restores project configuration from the base ref.
    //
    // This is also the whole trust model. Root = base, so the reviewer prompt and
    // the convention files read from there cannot have been authored by the PR.
    // Drop the `path:` from the second checkout and BOTH properties fall at once.
    const steps = (
      doc.jobs as { review?: { steps?: Array<{ uses?: string; with?: Record<string, unknown> }> } }
    )?.review?.steps;
    if (!Array.isArray(steps))
      throw new Error('claude-review.yml: jobs.review.steps is not an array');

    const checkouts = steps.filter((st) => String(st.uses ?? '').includes('actions/checkout'));
    expect(
      checkouts.length,
      'expected two checkouts: base at root, PR head in a subdirectory',
    ).toBe(2);

    const [root, head] = checkouts;
    expect(
      root?.with?.ref,
      `The FIRST checkout pins a ref, so the workspace root is no longer the base branch. That is the pattern the action documents as unsafe, and it is what makes .github/claude-review-prompt.md trustworthy — a PR could otherwise author the prompt its own reviewer runs on.\n\nref: ${String(root?.with?.ref)}`,
    ).toBeUndefined();

    expect(
      head?.with?.path,
      'The second checkout has no `path:`, so it lands at the workspace root and overwrites the base — untrusted content at the root, which is exactly the documented failure.',
    ).toBe('pr-head');
    expect(
      String(head?.with?.ref),
      'The second checkout no longer takes the PR head, so the reviewer has no access to the changed files at all.',
    ).toContain('/head');

    // Every checkout that names a ref must be confined to a subdirectory.
    for (const c of checkouts) {
      if (c.with?.ref === undefined) continue;
      expect(
        c.with?.path,
        `A checkout pins ref ${String(c.with.ref)} with no path, so it lands at the root. Any ref-pinned checkout must go to a subdirectory.`,
      ).toBeTruthy();
    }
  });
});
