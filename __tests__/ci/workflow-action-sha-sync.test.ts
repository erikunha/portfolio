import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// behavioral-test-allow: the artifacts under test ARE the workflow files; an action path embedded in claude_args has no runtime surface in this repository.
const WORKFLOW_DIR = join(process.cwd(), '.github', 'workflows');
const USES = /uses:\s*(?<repo>[\w.-]+\/[\w.-]+)(?:\/[^@\s]+)?@(?<sha>[0-9a-f]{40})/g;
const ACTION_PATH = /_actions\/(?<repo>[\w.-]+\/[\w.-]+)\/(?<sha>[0-9a-f]{40})/g;

const workflows = readdirSync(WORKFLOW_DIR)
  .filter((file) => /\.ya?ml$/.test(file))
  .map((file) => ({ file, text: readFileSync(join(WORKFLOW_DIR, file), 'utf8') }));

describe('action SHAs embedded in workflow text', () => {
  it.each(workflows)('$file embeds only SHAs that its uses: lines pin', ({ text }) => {
    const pinned = new Map<string, Set<string>>();
    for (const match of text.matchAll(USES)) {
      const { repo = '', sha = '' } = match.groups ?? {};
      pinned.set(repo, (pinned.get(repo) ?? new Set()).add(sha));
    }
    const stale = [...text.matchAll(ACTION_PATH)]
      .map((match) => ({ repo: match.groups?.repo ?? '', sha: match.groups?.sha ?? '' }))
      .filter(({ repo, sha }) => !pinned.get(repo)?.has(sha))
      .map(({ repo, sha }) => `${repo}@${sha}`);
    expect(stale).toEqual([]);
  });

  it('finds at least one embedded action path (anti-vacuous)', () => {
    const count = workflows.reduce((n, { text }) => n + [...text.matchAll(ACTION_PATH)].length, 0);
    expect(count).toBeGreaterThan(0);
  });
});
