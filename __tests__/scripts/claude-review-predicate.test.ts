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
  `\${{ (${predicate}) && format('claude-review-{0}', github.event.issue.number) || format('claude-review-noop-{0}', github.run_id) }}`;

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

describe('the review is opt-in, fenced, and the workspace root holds default-branch content', () => {
  const doc = workflow();

  it('the only trigger is a created comment, so no open or push starts a review', () => {
    const triggers = (doc.on ?? doc.true ?? {}) as Record<string, { types?: string[] }>;
    expect(
      Object.keys(triggers),
      'claude-review.yml declares a trigger besides issue_comment. A review must start only when someone comments `/claude-review`; any other event makes it automatic.',
    ).toEqual(['issue_comment']);
    expect(triggers.issue_comment?.types).toEqual(['created']);
  });

  it('the job admits only an OWNER, MEMBER or COLLABORATOR comment carrying the phrase on a PR', () => {
    const jobIf = collapse(String(at(doc, ['jobs', 'review', 'if'])));
    expect(jobIf, 'the job no longer requires the issue_comment event').toContain(
      "github.event_name == 'issue_comment'",
    );
    expect(jobIf, 'the job no longer requires the comment to be on a PR').toContain(
      'github.event.issue.pull_request',
    );
    expect(jobIf, 'the job no longer requires the trigger phrase').toContain(
      "contains(github.event.comment.body, '/claude-review')",
    );
    expect(
      jobIf,
      `The allow-list is not exactly OWNER/MEMBER/COLLABORATOR on the commenter.\n\nif: ${jobIf}`,
    ).toContain(
      `contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'), github.event.comment.author_association)`,
    );
    expect(
      /pull_request\./.test(jobIf.replace(/github\.event\.issue\.pull_request/g, '')),
      'The job predicate reads a pull_request event field. No such event reaches this workflow, so the clause is dead or the trigger drifted.',
    ).toBe(false);
  });

  it('the workspace root holds DEFAULT-BRANCH content, and the PR head is confined to a subdirectory', () => {
    // The comment event carries no PR base, and `github.sha` is the default
    // branch tip there. The PR head must never reach the workspace root, or the
    // reviewer's conventions and prompt would be authored by the PR under review.
    const steps = (
      doc.jobs as { review?: { steps?: Array<{ uses?: string; with?: Record<string, unknown> }> } }
    )?.review?.steps;
    if (!Array.isArray(steps))
      throw new Error('claude-review.yml: jobs.review.steps is not an array');

    const checkouts = steps.filter((st) => String(st.uses ?? '').includes('actions/checkout'));
    expect(
      checkouts.length,
      'expected two checkouts: default branch at root, PR head in a subdirectory',
    ).toBe(2);
    const [root, head] = checkouts;

    const rootRef = String(root?.with?.ref ?? '');
    expect(
      rootRef,
      `The root checkout does not pin the default-branch tip (ref: ${rootRef || '(none)'}). Omitting it would default to the PR merge ref on some events, which is PR-authored content.`,
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression the workflow file spells literally, not a JS template.
    ).toBe('${{ github.sha }}');
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
    // Compared as SETS of -name tokens per find, not as tokens present anywhere
    // in the step. Matching against the whole string let the verify `find` be
    // narrowed to a single name while every token still appeared in the rm
    // `find` — restoring exactly the rm/verify drift this is meant to forbid.
    const findBlocks = run
      .split(/(?=find pr-head)/)
      .filter((b) => b.startsWith('find pr-head') && b.includes('-name'));
    expect(
      findBlocks.length,
      'The strip does not re-run its own predicate to verify. A mistyped name would delete nothing and the step would still succeed.',
    ).toBe(2);
    const nameSet = (block: string) =>
      [...block.matchAll(/-name '([^']+)'/g)].map((m) => m[1]).sort();
    expect(
      nameSet(findBlocks[1] ?? ''),
      'The verify `find` matches a different set of names than the removing `find`. They must be identical, or the verify passes while something survives.',
    ).toEqual(nameSet(findBlocks[0] ?? ''));
    expect(
      /leftover/.test(run) && /exit 1/.test(run),
      'The strip does not fail when something survives it.',
    ).toBe(true);
  });

  it('symlinks are deleted from the mounted PR copy before the name match and the verification', () => {
    const steps = (doc.jobs as { review?: { steps?: Array<{ name?: string; run?: string }> } })
      ?.review?.steps;
    const run = String(
      steps?.find((st) => String(st.name ?? '').includes('Strip instruction-shaped'))?.run ?? '',
    );
    const link = run.indexOf('find pr-head -type l -delete');
    expect(
      link,
      'The strip leaves symlinks in pr-head. A link named innocuously can resolve to an instruction-shaped file outside the name match.',
    ).toBeGreaterThanOrEqual(0);
    expect(link).toBeLessThan(run.indexOf("-name 'CLAUDE.md'"));
    expect(link).toBeLessThan(run.indexOf('leftover=$(find pr-head'));
  });
});
