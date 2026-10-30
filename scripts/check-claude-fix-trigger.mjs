#!/usr/bin/env node

/**
 * Decides whether the CI fixer may act on a pull request, and posts the
 * round-cap hand-off when it may not.
 *
 * Runs before any pull-request code is fetched, so a fork can never reach an
 * install step. It reads only what the guards need: the pull request, its
 * changed files, its review threads, the reviewer's verdict and the commits the
 * bot already authored on the branch.
 */

import { execFile } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

export const CLAUDE_LOGIN = 'claude[bot]';
export const EXTERNAL_FIXER_LABEL = 'external-fixer';
export const DEFAULT_MAX_ROUNDS = 5;
export const ROUND_CAP_MARKER = '<!-- claude-fix:round-cap -->';
export const HEAD_SHA_GAP_MAX = 24;
export const INSTRUCTION_SHAPED_NAMES = Object.freeze([
  'CLAUDE.md',
  'AGENTS.md',
  'copilot-instructions.md',
  '.claude',
  '.agents',
  '.codex',
  '.cursor',
]);

export const REVIEWED_SHA_PATTERN = new RegExp(
  `\\bhead\\b[^\`\\n]{0,${HEAD_SHA_GAP_MAX}}\`([0-9a-f]{7,40})\``,
  'i',
);

const VERDICT_PATTERNS = Object.freeze({
  reject: /\*\*[^*]*\breject\b[^*]*\*\*/i,
  'request-changes': /\*\*[^*]*\brequest changes\b[^*]*\*\*/i,
  approve: /\*\*[^*]*\bapprove\b[^*]*\*\*/i,
});

export function parseVerdict(body) {
  if (VERDICT_PATTERNS.reject.test(body)) return 'reject';
  if (VERDICT_PATTERNS['request-changes'].test(body)) return 'request-changes';
  if (VERDICT_PATTERNS.approve.test(body)) return 'approve';
  return 'none';
}

export function extractReviewedSha(body) {
  const sha = body.match(REVIEWED_SHA_PATTERN)?.[1];
  return sha ? sha.toLowerCase() : null;
}

export function isInstructionShaped(filePath) {
  return filePath.split('/').some((segment) => INSTRUCTION_SHAPED_NAMES.includes(segment));
}

export function isBlockingVerdict(verdict) {
  return verdict === 'request-changes' || verdict === 'reject';
}

/**
 * The ordered guards. Each one returns a decision; the first that trips wins,
 * so the reason names the guard that actually stopped the fixer.
 */
export function evaluateFixGate(input) {
  const {
    reviewConclusion,
    repository,
    headRepository,
    headBranch,
    defaultBranch,
    prNumber,
    baseRef,
    allowMainBase,
    labels,
    changedFiles,
    unresolvedBotThreads,
    verdict,
    reviewedSha,
    headSha,
    botCommitCount,
    maxRounds,
  } = input;

  const skip = (reason) => ({ shouldFix: false, requestHuman: false, trigger: 'none', reason });

  if (reviewConclusion !== 'success') {
    return skip(`the review run concluded "${reviewConclusion}"`);
  }
  if (headRepository !== repository) {
    return skip(`the head repository ${headRepository} is not ${repository}`);
  }
  if (headBranch === defaultBranch) {
    return skip(`the review ran on the default branch ${defaultBranch}`);
  }
  if (prNumber === null) {
    return skip('no pull request is associated with the review run');
  }
  if (baseRef === defaultBranch && !allowMainBase) {
    return skip(
      `the pull request is based on ${defaultBranch} and CLAUDE_FIX_ALLOW_MAIN_BASE does not allow it`,
    );
  }
  if (labels.includes(EXTERNAL_FIXER_LABEL)) {
    return skip(`the pull request carries the ${EXTERNAL_FIXER_LABEL} label`);
  }
  const instructionFile = changedFiles.find(isInstructionShaped);
  if (instructionFile) {
    return skip(`the pull request changes the instruction file ${instructionFile}`);
  }

  const verdictOnHead =
    isBlockingVerdict(verdict) && reviewedSha !== null && headSha.startsWith(reviewedSha);
  const trigger = unresolvedBotThreads > 0 ? 'threads' : verdictOnHead ? 'verdict' : 'none';
  if (trigger === 'none') {
    return skip(
      'the review left no unresolved claude[bot] finding and no request-changes verdict on the head',
    );
  }

  if (botCommitCount >= maxRounds) {
    return {
      shouldFix: false,
      requestHuman: true,
      trigger,
      reason: `the fix round cap of ${maxRounds} is reached`,
    };
  }

  return {
    shouldFix: true,
    requestHuman: false,
    trigger,
    reason: `${unresolvedBotThreads} unresolved claude[bot] finding(s) on the head`,
  };
}

const THREADS_QUERY =
  'query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100){nodes{id isResolved comments(first:100){nodes{databaseId author{login} createdAt body}}}}}}}';

async function ghApi(args) {
  const { stdout } = await execFileP('gh', args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout;
}

async function ghApiJson(args) {
  return JSON.parse(await ghApi(args));
}

async function ghPaginatedJson(path) {
  const pages = await ghApiJson(['api', '--paginate', '--slurp', path]);
  return pages.flat();
}

function writeOutput(name, value) {
  const target = process.env.GITHUB_OUTPUT;
  if (!target) return;
  appendFileSync(target, `${name}=${value}\n`);
}

async function resolvePrNumber(repo, owner, headBranch, payloadPr) {
  if (payloadPr) return Number(payloadPr);
  const pulls = await ghApiJson([
    'api',
    `repos/${repo}/pulls?state=open&head=${owner}:${headBranch}`,
  ]);
  const number = Array.isArray(pulls) ? pulls[0]?.number : undefined;
  return typeof number === 'number' ? number : null;
}

function countUnresolvedBotThreads(threads, since) {
  const qualifying = threads.filter((thread) => {
    if (thread?.isResolved) return false;
    const first = thread?.comments?.nodes?.[0];
    if (!first) return false;
    if ((first.author?.login ?? '') !== CLAUDE_LOGIN) return false;
    return (first.createdAt ?? '') >= since;
  });
  return {
    count: qualifying.length,
    anchor: qualifying[0]?.comments?.nodes?.[0]?.databaseId ?? null,
    threadId: qualifying[0]?.id ?? null,
    alreadyAsked: qualifying.some((thread) =>
      (thread?.comments?.nodes ?? []).some((comment) =>
        (comment?.body ?? '').includes(ROUND_CAP_MARKER),
      ),
    ),
  };
}

function latestVerdictComment(comments) {
  const botComments = comments
    .filter((comment) => comment?.user?.login === CLAUDE_LOGIN)
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    .reverse();
  return botComments.find((comment) => parseVerdict(comment?.body ?? '') !== 'none') ?? null;
}

async function postRoundCapComment(repo, prNumber, anchorId, body) {
  await ghApi([
    'api',
    '-X',
    'POST',
    `repos/${repo}/pulls/${prNumber}/comments/${anchorId}/replies`,
    '-f',
    `body=${body}`,
  ]);
}

export async function run() {
  const env = process.env;
  const repo = env.REPO ?? '';
  const owner = env.OWNER ?? repo.split('/')[0] ?? '';
  const headBranch = env.HEAD_BRANCH ?? '';
  const defaultBranch = env.DEFAULT_BRANCH ?? '';
  const headShaFromEvent = env.HEAD_SHA ?? '';
  const reviewStartedAt = env.REVIEW_STARTED_AT ?? '';
  const maxRounds = Number(env.MAX_ROUNDS ?? '') || DEFAULT_MAX_ROUNDS;
  const allowMainBase = (env.ALLOW_MAIN_BASE ?? '').toLowerCase() === 'true';

  const prNumber = await resolvePrNumber(repo, owner, headBranch, env.PR_NUMBER ?? '');
  const pull =
    prNumber === null ? null : await ghApiJson(['api', `repos/${repo}/pulls/${prNumber}`]);
  const headSha = pull?.head?.sha ?? headShaFromEvent;

  const changedFiles =
    pull === null
      ? []
      : (await ghPaginatedJson(`repos/${repo}/pulls/${prNumber}/files`)).map(
          (file) => file.filename,
        );

  const threads =
    pull === null
      ? []
      : ((
          await ghApiJson([
            'api',
            'graphql',
            '-f',
            `query=${THREADS_QUERY}`,
            '-f',
            `owner=${owner}`,
            '-f',
            `name=${env.REPO_NAME ?? repo.split('/')[1] ?? ''}`,
            '-F',
            `number=${prNumber}`,
          ])
        ).data?.repository?.pullRequest?.reviewThreads?.nodes ?? []);

  const unresolved = countUnresolvedBotThreads(threads, reviewStartedAt);

  const comments =
    pull === null ? [] : await ghPaginatedJson(`repos/${repo}/issues/${prNumber}/comments`);
  const verdictComment = latestVerdictComment(comments);
  const verdict = parseVerdict(verdictComment?.body ?? '');
  const reviewedSha = extractReviewedSha(verdictComment?.body ?? '');

  const commits =
    pull === null ? [] : await ghPaginatedJson(`repos/${repo}/pulls/${prNumber}/commits`);
  const botCommitCount = commits.filter((commit) => commit?.author?.login === CLAUDE_LOGIN).length;

  const decision = evaluateFixGate({
    reviewConclusion: env.REVIEW_CONCLUSION ?? '',
    repository: repo,
    headRepository: env.HEAD_REPOSITORY ?? '',
    headBranch,
    defaultBranch,
    prNumber,
    baseRef: pull?.base?.ref ?? '',
    allowMainBase,
    labels: (pull?.labels ?? []).map((label) => label.name),
    changedFiles,
    unresolvedBotThreads: unresolved.count,
    verdict,
    reviewedSha,
    headSha,
    botCommitCount,
    maxRounds,
  });

  if (decision.requestHuman) {
    const body = [
      ROUND_CAP_MARKER,
      `The CI fixer reached its round cap of ${maxRounds} on this pull request and stopped.`,
      'A human has to take over: address the remaining findings, or raise the',
      'CLAUDE_FIX_MAX_ROUNDS repository variable if more rounds are wanted.',
    ].join('\n');
    if (unresolved.anchor !== null && !unresolved.alreadyAsked) {
      await postRoundCapComment(repo, prNumber, unresolved.anchor, body);
      process.stdout.write('[claude-fix] posted the round-cap hand-off in a review thread\n');
    } else if (unresolved.alreadyAsked) {
      process.stdout.write('[claude-fix] the round-cap hand-off was already posted\n');
    } else {
      process.stdout.write('[claude-fix] no review thread to hand off to; see the workflow log\n');
    }
  }

  writeOutput('should_fix', decision.shouldFix ? 'true' : 'false');
  writeOutput('reason', decision.reason);
  writeOutput('pr_number', prNumber === null ? '' : String(prNumber));
  writeOutput('head_branch', headBranch);
  writeOutput('head_sha', headSha);
  writeOutput('trigger', decision.trigger);
  writeOutput('reviewed_sha', reviewedSha ?? '');
  writeOutput('unresolved_before', String(unresolved.count));
  writeOutput('bot_commits', String(botCommitCount));

  process.stdout.write(
    `[claude-fix] ${decision.shouldFix ? 'FIX' : 'SKIP'}: ${decision.reason} (pr=${prNumber ?? 'none'}, trigger=${decision.trigger})\n`,
  );
}

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch((error) => {
    process.stderr.write(
      `[claude-fix] ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
