#!/usr/bin/env tsx
// Usage: pnpm pr-size
//
// Calculates branch complexity vs origin/main and signals whether to split.
// Designed to run after each milestone block so you know when to open a PR
// vs keep accumulating commits.
//
// Thresholds:
//   Files:       yellow ≥10   red ≥25
//   Lines:       yellow ≥400  red ≥1200
//   Subsystems:  yellow ≥3    red ≥5
//
// Exits 0 = green/yellow (ok or warn), 1 = red (split recommended).

import { execFileSync } from 'node:child_process';

const THRESHOLDS = {
  files: { yellow: 10, red: 25 },
  lines: { yellow: 400, red: 1200 },
  subsystems: { yellow: 3, red: 5 },
};

function run(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: 'utf8' });
}

// Changed file names
const filesRaw = run('git', ['diff', 'origin/main...HEAD', '--name-only']);
const files = filesRaw.trim().split('\n').filter(Boolean);

// Line counts from numstat: added deleted filename
const numstat = run('git', ['diff', 'origin/main...HEAD', '--numstat']);
let insertions = 0;
let deletions = 0;
for (const line of numstat.trim().split('\n').filter(Boolean)) {
  const [ins, del] = line.split('\t');
  // Binary files show '-' — skip them
  if (ins !== '-' && del !== '-') {
    insertions += Number(ins);
    deletions += Number(del);
  }
}
const linesChanged = insertions + deletions;

// Group files into subsystems: top-2 path segments, collapsing known groups
function toSubsystem(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length === 1) return parts[0] ?? filePath; // root file
  // Keep top two segments for meaningful grouping
  return `${parts[0] ?? ''}/${parts[1] ?? ''}`;
}

const subsystemMap = new Map<string, number>();
for (const f of files) {
  const sys = toSubsystem(f);
  subsystemMap.set(sys, (subsystemMap.get(sys) ?? 0) + 1);
}
const subsystems = subsystemMap.size;

// Commit count on this branch
let commitCount = 0;
try {
  const log = run('git', ['rev-list', '--count', 'origin/main..HEAD']);
  commitCount = Number(log.trim());
} catch {
  // ignore if no origin/main
}

type Level = 'green' | 'yellow' | 'red';

function level(val: number, yellow: number, red: number): Level {
  if (val >= red) return 'red';
  if (val >= yellow) return 'yellow';
  return 'green';
}

const fileLevel = level(files.length, THRESHOLDS.files.yellow, THRESHOLDS.files.red);
const lineLevel = level(linesChanged, THRESHOLDS.lines.yellow, THRESHOLDS.lines.red);
const sysLevel = level(subsystems, THRESHOLDS.subsystems.yellow, THRESHOLDS.subsystems.red);

const overallLevel: Level = [fileLevel, lineLevel, sysLevel].includes('red')
  ? 'red'
  : [fileLevel, lineLevel, sysLevel].includes('yellow')
    ? 'yellow'
    : 'green';

// Terminal colors
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  dim: '\x1b[2m',
};

function colorize(s: string, lvl: Level): string {
  if (lvl === 'red') return `${C.red}${s}${C.reset}`;
  if (lvl === 'yellow') return `${C.yellow}${s}${C.reset}`;
  return `${C.green}${s}${C.reset}`;
}

function row(label: string, val: number, lvl: Level, thresholds: { yellow: number; red: number }) {
  const valStr = colorize(String(val).padStart(5), lvl);
  process.stdout.write(
    `  ${label.padEnd(20)} ${valStr}   ${C.dim}(yellow ≥${thresholds.yellow}, red ≥${thresholds.red})${C.reset}\n`,
  );
}

process.stdout.write(
  `\n${C.bold}PR Size Report${C.reset}  ${C.dim}(${commitCount} commit(s) ahead of origin/main)${C.reset}\n`,
);
process.stdout.write(`${'─'.repeat(60)}\n`);
row('Files changed:', files.length, fileLevel, THRESHOLDS.files);
row('Lines changed:', linesChanged, lineLevel, THRESHOLDS.lines);
row('Subsystems touched:', subsystems, sysLevel, THRESHOLDS.subsystems);

process.stdout.write(`\n  ${C.dim}Subsystems:${C.reset}\n`);
for (const [sys, count] of [...subsystemMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  process.stdout.write(`    ${sys.padEnd(40)} ${C.dim}${count} file(s)${C.reset}\n`);
}

process.stdout.write(`\n${'─'.repeat(60)}\n`);

if (overallLevel === 'red') {
  process.stdout.write(`${C.red}${C.bold}SPLIT RECOMMENDED${C.reset} — branch is too large.\n`);
  process.stdout.write(
    `${C.dim}  Open a PR with completed milestones now, then continue on a new branch.${C.reset}\n\n`,
  );
  process.exit(1);
} else if (overallLevel === 'yellow') {
  process.stdout.write(`${C.yellow}${C.bold}SIZE WARNING${C.reset} — branch is getting large.\n`);
  process.stdout.write(
    `${C.dim}  If the current milestone is complete, consider opening a PR now.${C.reset}\n\n`,
  );
  process.exit(0);
} else {
  process.stdout.write(`${C.green}${C.bold}SIZE OK${C.reset} — safe to keep building.\n\n`);
  process.exit(0);
}
