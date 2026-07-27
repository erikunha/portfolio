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

describe('the auto path is fenced, and the workspace root holds base content', () => {
  const doc = workflow();

  it('the auto path admits only OWNER, MEMBER or COLLABORATOR', () => {
    // Kept after the trigger reverted to `pull_request`, where forks get no
    // secrets and the fence is no longer load-bearing. It is retained because it
    // costs nothing, and because `pull_request_target` was tried once and may be
    // tried again if upstream starts accepting its OIDC token — at which point
    // the fence becomes the only thing between a fork PR and the repo token.
    const jobIf = collapse(String(at(doc, ['jobs', 'review', 'if'])));
    const auto = splitTopLevelOr(jobIf).find((b) => !b.includes('issue_comment'));
    expect(
      auto,
      `No top-level disjunct of the review job's \`if:\` covers the non-comment path.\n\nif: ${jobIf}`,
    ).toBeTruthy();
    expect(
      auto,
      `The auto branch does not fence on github.event.pull_request.author_association.\n\nbranch: ${auto}`,
    ).toContain('github.event.pull_request.author_association');
    expect(
      auto,
      `The auto branch's allow-list is not exactly OWNER/MEMBER/COLLABORATOR.\n\nbranch: ${auto}`,
    ).toContain(`fromJSON('["OWNER","MEMBER","COLLABORATOR"]')`);
  });

  it('the workspace root holds BASE content, and the PR head is confined to a subdirectory', () => {
    // The whole trust model, and it is trigger-sensitive in a way that bites.
    // Under `pull_request_target` the DEFAULT ref is the base, so omitting `ref:`
    // was correct. Under `pull_request` the default is `refs/pull/N/merge` — PR
    // code — so the root MUST pin the base explicitly or the model silently
    // inverts and every convention file read from the root becomes the PR's.
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

    const rootRef = String(root?.with?.ref ?? '');
    expect(
      /base/.test(rootRef),
      `The root checkout does not resolve to the PR base (ref: ${rootRef || '(none)'}). Under \`pull_request\` the default ref is the MERGE ref, which is PR-authored content — the root must name the base explicitly.`,
    ).toBe(true);
    expect(
      /head\.sha|\/head/.test(rootRef),
      `The root checkout resolves to the PR HEAD (${rootRef}). That puts untrusted content at the workspace root, which the action documents as unsafe and which makes the reviewer prompt PR-authored.`,
    ).toBe(false);
    expect(root?.with?.path, 'the root checkout must stay at the workspace root').toBeUndefined();

    expect(
      head?.with?.path,
      'The second checkout has no `path:`, so it lands at the root and overwrites the base.',
    ).toBe('pr-head');
    expect(
      String(head?.with?.ref),
      'The second checkout no longer takes the PR head, so the reviewer cannot see the changed files.',
    ).toContain('/head');
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

    // Matched by NAME across the subtree, not by fixed root paths. A root-only
    // strip left `pr-head/lib/CLAUDE.md` in place AND reported success, because
    // its verify loop checked the same fixed paths the rm had listed.
    expect(
      /find pr-head/.test(run),
      'The strip no longer walks the subtree. The CLI discovers CLAUDE.md and AGENTS.md in subdirectories, so a fixed-path strip misses `pr-head/lib/CLAUDE.md` entirely.',
    ).toBe(true);
    for (const name of ['CLAUDE.md', 'AGENTS.md', '.claude', '.cursor']) {
      expect(
        run,
        `The strip no longer matches ${name}, which the CLI would ingest as project instructions authored by the PR under review.`,
      ).toContain(`-name '${name}'`);
    }

    // It must VERIFY with the SAME predicate that removed. An independently
    // enumerated verify drifts from the rm the first time either is edited, and
    // then passes while removing nothing.
    const finds = run.match(/find pr-head/g) ?? [];
    expect(
      finds.length,
      'The strip does not re-run its own predicate to verify. A mistyped name would then delete nothing and the step would still succeed.',
    ).toBeGreaterThanOrEqual(2);
    expect(
      /leftover/.test(run) && /exit 1/.test(run),
      'The strip does not fail when something survives it.',
    ).toBe(true);
  });
});
