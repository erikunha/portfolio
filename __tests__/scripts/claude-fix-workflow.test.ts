import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const FIX_WORKFLOW = join(process.cwd(), '.github', 'workflows', 'claude-fix.yml');
const REVIEW_WORKFLOW = join(process.cwd(), '.github', 'workflows', 'claude-review.yml');

type Workflow = {
  on?: Record<string, unknown>;
  concurrency?: { group?: string; 'cancel-in-progress'?: unknown };
  permissions?: Record<string, string>;
  jobs?: Record<string, { if?: string; steps?: Step[] }>;
};

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
  with?: Record<string, string>;
};

function workflow(path: string): Workflow {
  const doc = parse(readFileSync(path, 'utf8')) as Workflow;
  if (!doc || typeof doc !== 'object') {
    throw new Error(`${path} did not parse to a mapping`);
  }
  return doc;
}

const fix = workflow(FIX_WORKFLOW);
const review = workflow(REVIEW_WORKFLOW);

function steps(job: string): Step[] {
  const found = fix.jobs?.[job]?.steps;
  if (!Array.isArray(found)) throw new Error(`claude-fix.yml: jobs.${job}.steps is not an array`);
  return found;
}

function actionStep(): Step {
  const step = steps('fix').find((s) => String(s.uses ?? '').includes('claude-code-action'));
  if (!step) throw new Error('claude-fix.yml: no step runs anthropics/claude-code-action');
  return step;
}

function pin(uses: string): string {
  const at = uses.lastIndexOf('@');
  return uses.slice(at + 1);
}

function reviewActionStep(): Step {
  const found = review.jobs?.review?.steps?.find((s) =>
    String(s.uses ?? '').includes('claude-code-action'),
  );
  if (!found) throw new Error('claude-review.yml: no step runs anthropics/claude-code-action');
  return found;
}

describe('the fixer runs the same action, from the same pin, with the same auth as the reviewer', () => {
  it('pins the action to the same commit the reviewer pins', () => {
    expect(
      pin(actionStep().uses ?? ''),
      'The fixer must run the same action commit as the reviewer. Two pins means two versions of the token exchange, and the one the fixer relies on to push as claude[bot] is the one that can drift.',
    ).toBe(pin(reviewActionStep().uses ?? ''));
  });

  it('uses the same auth input as the reviewer', () => {
    const fixerAuth = actionStep().with?.claude_code_oauth_token;
    const reviewerAuth = reviewActionStep().with?.claude_code_oauth_token;
    expect(
      fixerAuth,
      'The fixer must authenticate the way the reviewer does. A different auth input posts as a different identity, and the repository keys on claude[bot].',
    ).toBe(reviewerAuth);
    expect(fixerAuth).toBeTruthy();
  });
});

describe('the trigger is a trusted context', () => {
  it('runs on the completion of the review workflow, not on a pull request event', () => {
    const triggers = fix.on ?? {};
    expect(
      Object.keys(triggers),
      'The fixer must hang off the review workflow completing. A pull_request or pull_request_review trigger loads the workflow file from the pull request, which would hand a pull request author the write token this workflow holds.',
    ).toEqual(['workflow_run']);
    const workflowRun = triggers.workflow_run as { workflows?: string[]; types?: string[] };
    expect(workflowRun.workflows).toEqual(['Claude Review']);
    expect(workflowRun.types).toEqual(['completed']);
  });

  it('never triggers on a pull request event of its own', () => {
    const triggers = Object.keys(fix.on ?? {});
    for (const event of ['pull_request', 'pull_request_target', 'pull_request_review']) {
      expect(
        triggers,
        `${event} loads this file from the pull request head, so the pull request could author the fixer, its prompt and its gates.`,
      ).not.toContain(event);
    }
  });
});

describe('the guards are structural, not prose', () => {
  it('refuses a head repository that is not this repository, before the job starts', () => {
    const jobIf = fix.jobs?.fix?.if ?? '';
    expect(
      jobIf,
      'The job condition must compare the head repository with this repository. A fork pull request must never reach a step that holds a write token.',
    ).toContain('github.event.workflow_run.head_repository.full_name == github.repository');
  });

  it('refuses a review run that did not succeed', () => {
    expect(fix.jobs?.fix?.if ?? '').toContain("github.event.workflow_run.conclusion == 'success'");
  });

  it('wires the base-branch opt-in and the round cap to repository variables', () => {
    const gate = steps('fix').find((s) => s.name === 'Decide whether the fixer may act');
    if (!gate) throw new Error('claude-fix.yml: the gate step is missing');
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, not a JS template. Interpolating it would bake the value in at test-authoring time and the assertion would no longer compare the workflow against what it actually contains.
    expect(gate.env?.ALLOW_MAIN_BASE).toBe('${{ vars.CLAUDE_FIX_ALLOW_MAIN_BASE }}');
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, not a JS template.
    expect(gate.env?.MAX_ROUNDS).toBe('${{ vars.CLAUDE_FIX_MAX_ROUNDS }}');
  });

  it('runs the action only when the gate decided the fixer may act', () => {
    expect(
      actionStep().if,
      'The action must be gated on the gate decision. Without it the fixer runs on every completed review, including approving ones and every pull request the loop was told to skip.',
    ).toBe("steps.gate.outputs.should_fix == 'true'");
  });

  it('materialises the fixer prompt from the default branch, with the reviewer byte floor', () => {
    const materialise = steps('fix').find((s) =>
      String(s.name ?? '').includes('Materialise the trusted fixer prompt'),
    );
    if (!materialise?.run)
      throw new Error('claude-fix.yml: the prompt materialisation step is missing');
    expect(materialise.run).toContain('git fetch --depth=1 origin "$DEFAULT_BRANCH"');
    expect(materialise.run).toContain(
      'git show "FETCH_HEAD:.github/claude-fix-prompt.md" > /tmp/claude-fix-prompt.md',
    );

    const floorOf = (script: string): number => {
      const hit = /-lt (\d+)/.exec(script);
      if (!hit?.[1]) throw new Error('no byte floor in the materialisation step');
      return Number(hit[1]);
    };
    const reviewerMaterialise = review.jobs?.review?.steps?.find((s) =>
      String(s.name ?? '').includes('Materialise the trusted reviewer prompt'),
    );
    expect(
      floorOf(materialise.run),
      'The two materialisations must carry the same byte floor. A truncated prompt is worse than a missing one: it runs the agent on a fragment.',
    ).toBe(floorOf(reviewerMaterialise?.run ?? ''));
  });
});

describe('the concurrency group admits one fixer per pull request', () => {
  it('groups on the pull request the review ran for', () => {
    expect(fix.concurrency?.group ?? '').toContain(
      'github.event.workflow_run.pull_requests[0].number',
    );
  });

  it('does not cancel a fixer that is already running', () => {
    expect(
      fix.concurrency?.['cancel-in-progress'],
      'Cancelling a fixer half-way leaves a pushed commit and unresolved threads behind, and the next round starts from a state nobody can reason about.',
    ).toBe(false);
  });
});

describe('the permissions are the least the fixer needs', () => {
  it('grants exactly the scopes the fixer reads and writes', () => {
    expect(fix.permissions).toEqual({
      contents: 'write',
      'pull-requests': 'write',
      issues: 'read',
      'id-token': 'write',
    });
  });

  it('grants no write scope beyond the pull request and the repository contents', () => {
    // `id-token: write` mints an OIDC token; it carries no repository scope of
    // its own, so it is not a repository write. The action exchanges it for the
    // Claude App token, and that token's scopes come from this job's grants.
    const writable = Object.entries(fix.permissions ?? {}).filter(
      ([scope, level]) => level === 'write' && scope !== 'id-token',
    );
    expect(
      writable.map(([scope]) => scope).sort(),
      'The fixer writes code and answers in threads. It writes nothing else.',
    ).toEqual(['contents', 'pull-requests']);
  });
});
