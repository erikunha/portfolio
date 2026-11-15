import { spawnSync } from 'node:child_process';

const BYTES_PER_MIB = 1024 * 1024;
export const GIT_MAX_BUFFER_BYTES = 256 * BYTES_PER_MIB;
const GIT_OK = 0;
const LINE_BREAK = '\n';

export interface GitOptions {
  cwd?: string;
  trim?: boolean;
}

interface GitRun {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runGit(args: string[], cwd: string | undefined): GitRun {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: GIT_MAX_BUFFER_BYTES,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

export function gitText(args: string[], opts: GitOptions = {}): string {
  const result = runGit(args, opts.cwd);
  if (result.status !== GIT_OK) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return opts.trim === false ? result.stdout : result.stdout.trim();
}

export function trackedFiles(pathspecs: string[] = [], opts: GitOptions = {}): string[] {
  const args = pathspecs.length > 0 ? ['ls-files', '--', ...pathspecs] : ['ls-files'];
  return gitText(args, opts).split(LINE_BREAK).filter(Boolean);
}

export function showAtRef(ref: string, path: string, opts: GitOptions = {}): string | null {
  const result = runGit(['show', `${ref}:${path}`], opts.cwd);
  return result.status === GIT_OK ? result.stdout : null;
}
