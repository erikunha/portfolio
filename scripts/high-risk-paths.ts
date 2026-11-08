import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const STDIN_FD = 0;
const LINE_BREAK = /\r?\n/;
const OUTPUT_SEPARATOR = '\n';

export const HIGH_RISK_PREFIXES: readonly string[] = [
  'app/api/',
  'lib/server/',
  'lib/ask/',
  'lib/agent/',
  '.github/workflows/',
  '.github/codeql/',
  '.husky/',
  '.semgrep/',
];

export const HIGH_RISK_FILES: readonly string[] = [
  'proxy.ts',
  'next.config.ts',
  'vercel.json',
  'lib/rate-limit.ts',
  'lib/env.ts',
  'lib/ip-hash.ts',
  'lib/ask-log.ts',
  'lib/contact-delivery.ts',
  'lib/contact-outbox.ts',
  '.env.example',
  '.gitleaks.toml',
  '.semgrepignore',
  '.npmrc',
  '.github/CODEOWNERS',
  '.github/dependabot.yml',
  'package.json',
  'pnpm-lock.yaml',
  'dependency-vetting.json',
];

function isHighRiskFile(file: string): boolean {
  return (
    HIGH_RISK_FILES.includes(file) || HIGH_RISK_PREFIXES.some((prefix) => file.startsWith(prefix))
  );
}

export function highRiskFiles(files: readonly string[]): string[] {
  return files.filter(isHighRiskFile);
}

export function isHighRisk(files: readonly string[]): boolean {
  return files.some(isHighRiskFile);
}

export function parseFileList(text: string): string[] {
  return text
    .split(LINE_BREAK)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function main(): void {
  const matched = highRiskFiles(parseFileList(readFileSync(STDIN_FD, 'utf8')));
  if (matched.length > 0) process.stdout.write(`${matched.join(OUTPUT_SEPARATOR)}\n`);
}

const entry = process.argv[1];
if (typeof entry === 'string' && import.meta.url === pathToFileURL(realpathSync(entry)).href) {
  main();
}
