import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts', 'guard-merge-main.mjs');
const BLOCK_EXIT_CODE = 2;
const MERGE_TOOL = 'mcp__github__merge_pull_request';

let dir: string;

const stubGh = (stdout: string, exitCode: number) => {
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  const file = join(bin, 'gh');
  writeFileSync(
    file,
    `#!/bin/sh\necho "$@" >> "${join(dir, 'calls')}"\npwd -P >> "${join(dir, 'cwds')}"\nprintf '%s' "${stdout}"\nexit ${exitCode}\n`,
  );
  chmodSync(file, 0o755);
};

const hook = (payload: Record<string, unknown>) =>
  spawnSync('node', [SCRIPT], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, PATH: `${join(dir, 'bin')}${delimiter}${process.env.PATH}` },
  });

const run = (command: string, cwd?: string) =>
  hook({ tool_name: 'Bash', tool_input: { command }, ...(cwd === undefined ? {} : { cwd }) });

const runTool = (toolInput: Record<string, unknown>) =>
  hook({ tool_name: MERGE_TOOL, tool_input: toolInput });

const calls = () =>
  existsSync(join(dir, 'calls')) ? readFileSync(join(dir, 'calls'), 'utf8') : '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'guard-merge-main-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('guard-merge-main hook', () => {
  it('blocks a merge whose PR targets main', () => {
    stubGh('main', 0);
    const result = run('gh pr merge 369 --squash');
    expect(result.status).toBe(BLOCK_EXIT_CODE);
    expect(result.stderr).toContain('targets main');
  });

  it('allows a merge whose PR targets an integration branch', () => {
    stubGh('feat/terminal-redesign', 0);
    expect(run('gh pr merge 369 --squash --delete-branch').status).toBe(0);
  });

  it('fails closed when the base cannot be determined', () => {
    stubGh('', 1);
    const result = run('gh pr merge 369');
    expect(result.status).toBe(BLOCK_EXIT_CODE);
    expect(result.stderr).toContain('could not be determined');
  });

  it('fails closed when gh is not installed', () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
      input: JSON.stringify({ tool_input: { command: 'gh pr merge 1' } }),
      encoding: 'utf8',
      env: { ...process.env, PATH: join(dir, 'empty') },
    });
    expect(result.status).toBe(BLOCK_EXIT_CODE);
  });

  it('checks the merge inside a compound command', () => {
    stubGh('main', 0);
    expect(run('pnpm ci:local && gh pr merge 7 --squash').status).toBe(BLOCK_EXIT_CODE);
  });

  it('passes the selector and repo to gh and skips flag values', () => {
    stubGh('feat/x', 0);
    run('gh pr merge --body "ready" -R owner/repo https://github.com/owner/repo/pull/9');
    const calls = spawnSync('cat', [join(dir, 'calls')], { encoding: 'utf8' }).stdout;
    expect(calls).toContain('pr view https://github.com/owner/repo/pull/9 --repo owner/repo');
  });

  it('ignores commands that are not a PR merge without calling gh', () => {
    stubGh('main', 0);
    expect(run('gh pr view 369').status).toBe(0);
    expect(run('git status').status).toBe(0);
    expect(spawnSync('test', ['-e', join(dir, 'calls')]).status).not.toBe(0);
  });

  it('blocks text that merely mentions a gh merge, the chosen fail-closed trade-off', () => {
    stubGh('feat/x', 0);
    expect(run('git commit -m "docs: gh pr merge guard"').status).toBe(BLOCK_EXIT_CODE);
    expect(run('echo "gh pr merge 5"').status).toBe(BLOCK_EXIT_CODE);
    expect(run("grep -rn 'gh pr merge' docs").status).toBe(BLOCK_EXIT_CODE);
    expect(run('gh pr view 5 --json title # gh pr merge').status).toBe(BLOCK_EXIT_CODE);
  });

  it('allows commands with no gh merge intent without calling gh', () => {
    stubGh('main', 0);
    expect(run('git status').status).toBe(0);
    expect(run('git merge origin/feat/terminal-redesign').status).toBe(0);
    expect(run('git commit -m "fix: merge guard"').status).toBe(0);
    expect(run('gh pr view 5 --json mergeStateStatus,mergeable').status).toBe(0);
    expect(run('gh pr create --title "merge fix" --base feat/x').status).toBe(0);
    expect(run('grep -rn "pr merge" docs').status).toBe(0);
    expect(calls()).toBe('');
  });

  it.each([
    '\\gh pr merge 5',
    '/opt/homebrew/bin/gh pr merge 5',
    '"gh" pr merge 5',
    "'gh' pr merge 5",
    'g""h pr merge 5',
    'gh -R o/r pr merge 5',
    'gh --repo o/r pr merge 5',
    'gh --repo=o/r pr merge 5',
    'gh pr -R o/r merge 5',
    '{ gh pr merge 5; }',
    'if true; then gh pr merge 5; fi',
    'gh \\\n pr merge 5',
    'gh pr   merge   5',
  ])('blocks a merge into main written as %s', (command) => {
    stubGh('main', 0);
    const result = run(command);
    expect(result.status).toBe(BLOCK_EXIT_CODE);
    expect(calls()).not.toBe('');
  });

  it.each([
    'for n in 1 2; do gh pr merge $n; done',
    'eval "gh pr merge 5"',
    'env -i gh pr merge 5',
    'sudo -u x gh pr merge 5',
    'xargs gh pr merge',
    'echo 5 | xargs gh pr merge',
    'g=gh; $g pr merge 5',
    'gh api graphql -f query="mutation { enablePullRequestAutoMerge(input: {pullRequestId: \\"X\\"}) { clientMutationId } }"',
    'gh api graphql -f query=\'mutation { mergePullRequest(input: {pullRequestId: "X"}) { clientMutationId } }\'',
    'gh api repos/o/r/merges -f base=main -f head=x',
    'gh api repos/o/r/merges -f base=feat/x -f head=y',
    'gh alias set m "pr merge"',
    'bash -c "gh pr merge 5"',
    "sh -c 'gh pr merge 5 --squash'",
    'gh pr merge 5 --body "gh pr merge 6"',
  ])('blocks %s even when the base would resolve to an integration branch', (command) => {
    stubGh('feat/x', 0);
    const result = run(command);
    expect(result.status).toBe(BLOCK_EXIT_CODE);
  });

  it('propagates GH_REPO to the base lookup and blocks a merge into main of that repository', () => {
    stubGh('main', 0);
    const result = run('GH_REPO=other/repo gh pr merge 5');
    expect(result.status).toBe(BLOCK_EXIT_CODE);
    expect(calls()).toContain('pr view 5 --repo other/repo');
  });

  it('propagates GH_REPO exported in an earlier segment, and lets -R override it', () => {
    stubGh('feat/x', 0);
    expect(run('export GH_REPO=other/repo; gh pr merge 5').status).toBe(0);
    expect(calls()).toContain('pr view 5 --repo other/repo');
    expect(run('GH_REPO=other/repo gh pr merge 5 -R o/r').status).toBe(0);
    expect(calls()).toContain('pr view 5 --repo o/r');
  });

  it('fails closed on a GH_REPO only the shell can resolve', () => {
    stubGh('feat/x', 0);
    expect(run('GH_REPO="$R" gh pr merge 5').status).toBe(BLOCK_EXIT_CODE);
  });

  it('allows a clean merge into an integration branch written with a prefix assignment or path', () => {
    stubGh('feat/x', 0);
    expect(run('GH_TOKEN=abc /opt/homebrew/bin/gh pr merge 5 --squash').status).toBe(0);
    expect(run('gh -R o/r pr merge 5').status).toBe(0);
    expect(run('{ gh pr merge 5; }').status).toBe(0);
    expect(run('pnpm ci:local && gh pr merge 7 --squash').status).toBe(0);
  });

  it.each([
    'bash -c "gh pr merge 5"',
    "sh -c 'gh pr merge 5 --squash'",
    'env GH_TOKEN=abc gh pr merge 5',
    'GH_TOKEN=abc gh pr merge 5',
    'sudo gh pr merge 5',
    'echo go\ngh pr merge 5',
    '(gh pr merge 5)',
    'echo $(gh pr merge 5)',
  ])('still checks a merge written as %s', (command) => {
    stubGh('main', 0);
    expect(run(command).status).toBe(BLOCK_EXIT_CODE);
  });

  it('reads a quoted body with spaces as one value and finds the selector after it', () => {
    stubGh('feat/x', 0);
    run('gh pr merge --body "ready to go; && done" 12');
    expect(calls()).toContain('pr view 12 --json');
  });

  it('unquotes a literal selector', () => {
    stubGh('feat/x', 0);
    run('gh pr merge "12"');
    expect(calls()).toContain('pr view 12 --json');
  });

  it('fails closed on a selector or repo only the shell can resolve', () => {
    stubGh('feat/x', 0);
    const selector = run('gh pr merge "$PR" --squash');
    expect(selector.status).toBe(BLOCK_EXIT_CODE);
    expect(selector.stderr).toContain('could not be determined');
    expect(run('gh pr merge 5 -R "$REPO"').status).toBe(BLOCK_EXIT_CODE);
    expect(calls()).toBe('');
  });

  it('resolves the PR from the directory a leading cd moves into', () => {
    stubGh('feat/x', 0);
    const start = join(dir, 'work', 'inner');
    const other = join(dir, 'work', 'other');
    mkdirSync(start, { recursive: true });
    mkdirSync(other, { recursive: true });
    expect(run('cd ../other && gh pr merge 5 --squash', start).status).toBe(0);
    expect(readFileSync(join(dir, 'cwds'), 'utf8').trim()).toBe(realpathSync(other));
  });

  it('resolves an absolute and a quoted cd target', () => {
    stubGh('feat/x', 0);
    const target = join(dir, 'a b');
    mkdirSync(target);
    expect(run(`cd "${target}" && gh pr merge 5`, dir).status).toBe(0);
    expect(readFileSync(join(dir, 'cwds'), 'utf8').trim()).toBe(realpathSync(target));
  });

  it('uses the hook directory when no cd precedes the merge', () => {
    stubGh('feat/x', 0);
    run('gh pr merge 5', dir);
    expect(readFileSync(join(dir, 'cwds'), 'utf8').trim()).toBe(realpathSync(dir));
  });

  it('fails closed when the cd target is missing or only the shell can resolve it', () => {
    stubGh('feat/x', 0);
    expect(run('cd ./missing && gh pr merge 5', dir).status).toBe(BLOCK_EXIT_CODE);
    expect(run('cd "$X" && gh pr merge 5', dir).status).toBe(BLOCK_EXIT_CODE);
    expect(run('cd - && gh pr merge 5', dir).status).toBe(BLOCK_EXIT_CODE);
  });

  it.each([
    'gh api -X PUT repos/o/r/pulls/5/merge',
    'gh api --method PUT repos/o/r/pulls/5/merge -f merge_method=squash',
    'gh api --method=put repos/o/r/pulls/5/merge',
    'gh api -XPUT /repos/o/r/pulls/5/merge',
    'gh api repos/o/r/pulls/5/merge -f merge_method=squash',
    'gh api "repos/o/r/pulls/5/merge" --input body.json',
    'gh api https://api.github.com/repos/o/r/pulls/5/merge -X PUT',
    'gh api repos/{owner}/{repo}/pulls/5/merge -X PUT',
  ])('blocks a REST merge into main written as %s', (command) => {
    stubGh('main', 0);
    const result = run(command);
    expect(result.status).toBe(BLOCK_EXIT_CODE);
    expect(result.stderr).toContain('targets main');
  });

  it('allows a REST merge whose PR targets an integration branch and passes the repo through', () => {
    stubGh('feat/x', 0);
    expect(run('gh api -X PUT repos/o/r/pulls/5/merge').status).toBe(0);
    expect(calls()).toContain('pr view 5 --repo o/r --json');
  });

  it('fails closed on a REST merge whose number or base cannot be determined', () => {
    stubGh('feat/x', 0);
    expect(run('gh api -X PUT repos/o/r/pulls/$N/merge').status).toBe(BLOCK_EXIT_CODE);
    stubGh('', 1);
    expect(run('gh api -X PUT repos/o/r/pulls/5/merge').status).toBe(BLOCK_EXIT_CODE);
  });

  it('blocks the GraphQL merge mutation, whose PR cannot be resolved from the command', () => {
    stubGh('feat/x', 0);
    const result = run(
      `gh api graphql -f query='mutation { mergePullRequest(input: {pullRequestId: "X"}) { clientMutationId } }'`,
    );
    expect(result.status).toBe(BLOCK_EXIT_CODE);
  });

  it('ignores other gh api calls without calling gh', () => {
    stubGh('main', 0);
    expect(run('gh api repos/o/r/pulls/5').status).toBe(0);
    expect(run('gh api repos/o/r/pulls/5/comments -f body=x').status).toBe(0);
    expect(run('gh api graphql -f query="{ viewer { login } }"').status).toBe(0);
    expect(calls()).toBe('');
  });

  describe('GitHub MCP merge tool', () => {
    it('blocks a merge whose PR targets main', () => {
      stubGh('main', 0);
      const result = runTool({ owner: 'o', repo: 'r', pullNumber: 7, merge_method: 'squash' });
      expect(result.status).toBe(BLOCK_EXIT_CODE);
      expect(result.stderr).toContain('targets main');
      expect(calls()).toContain('pr view 7 --repo o/r --json');
    });

    it('allows a merge whose PR targets an integration branch', () => {
      stubGh('feat/x', 0);
      expect(runTool({ owner: 'o', repo: 'r', pullNumber: 7 }).status).toBe(0);
    });

    it('fails closed when the base cannot be determined', () => {
      stubGh('', 1);
      expect(runTool({ owner: 'o', repo: 'r', pullNumber: 7 }).status).toBe(BLOCK_EXIT_CODE);
    });

    it('fails closed when the call names no PR', () => {
      stubGh('feat/x', 0);
      expect(runTool({}).status).toBe(BLOCK_EXIT_CODE);
      expect(runTool({ owner: 'o', repo: 'r' }).status).toBe(BLOCK_EXIT_CODE);
      expect(calls()).toBe('');
    });
  });
});
