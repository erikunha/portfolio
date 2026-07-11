#!/usr/bin/env tsx

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const FindingSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(['critical', 'important', 'minor']),
  title: z.string().min(1),
  file: z.string().optional(),
  source: z.string().min(1),
  status: z.enum(['open', 'resolved', 'justified']),
  resolution: z.string().optional(),
});
export type Finding = z.infer<typeof FindingSchema>;
export const LedgerSchema = z.array(FindingSchema);

export const LEDGER_PATH = '.review-findings.json';

export function blockingFindings(findings: Finding[]): Finding[] {
  return findings.filter(
    (f) => (f.severity === 'critical' || f.severity === 'important') && f.status === 'open',
  );
}

export function invalidResolutions(findings: Finding[]): Finding[] {
  return findings.filter((f) => f.status !== 'open' && (f.resolution ?? '').trim() === '');
}

export const ARCHIVE_PATH = '.review-findings-archive.jsonl';

export function archiveRecords(findings: Finding[], cycleSha: string, cycleIso: string): string {
  if (findings.length === 0) return '';
  return `${findings.map((f) => JSON.stringify({ ...f, cycleSha, cycleIso })).join('\n')}\n`;
}

export function findingId(source: string, title: string): string {
  return createHash('sha256').update(`${source}::${title}`).digest('hex').slice(0, 8);
}

export function withFinding(findings: Finding[], next: Finding): Finding[] {
  const existing = findings.findIndex((f) => f.id === next.id);
  if (existing === -1) return [...findings, next];
  const copy = findings.slice();
  copy[existing] = next;
  return copy;
}

export function withStatus(
  findings: Finding[],
  id: string,
  status: Finding['status'],
  resolution: string,
): Finding[] {
  const idx = findings.findIndex((f) => f.id === id);
  const current = idx === -1 ? undefined : findings[idx];
  if (!current) throw new Error(`No finding with id ${id}`);
  const copy = findings.slice();
  copy[idx] = { ...current, status, resolution };
  return copy;
}

export function readLedger(path = LEDGER_PATH): Finding[] | null {
  if (!existsSync(path)) return null;
  return LedgerSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

function writeLedger(findings: Finding[], path = LEDGER_PATH): void {
  writeFileSync(path, `${JSON.stringify(findings, null, 2)}\n`);
}

function main(argv: string[]): void {
  const [cmd, ...rest] = argv;
  const ledger = readLedger() ?? [];

  switch (cmd) {
    case 'clear':
      writeLedger([]);
      console.log('[review-findings] ledger cleared (new cycle).');
      return;
    case 'add': {
      const [severity, source, ...titleParts] = rest;
      const title = titleParts.join(' ');
      if (!severity || !source || !title) {
        console.error('usage: review-findings add <critical|important|minor> <source> <title...>');
        process.exit(1);
      }
      const finding = FindingSchema.parse({
        id: findingId(source, title),
        severity,
        source,
        title,
        status: 'open',
      });
      writeLedger(withFinding(ledger, finding));
      console.log(`[review-findings] recorded ${finding.severity} ${finding.id}: ${finding.title}`);
      return;
    }
    case 'resolve':
    case 'justify': {
      const [id, ...reasonParts] = rest;
      const reason = reasonParts.join(' ');
      if (!id || reason.trim() === '') {
        console.error(
          `usage: review-findings ${cmd} <id> <${cmd === 'resolve' ? 'sha' : 'reason'}...>`,
        );
        process.exit(1);
      }
      writeLedger(withStatus(ledger, id, cmd === 'resolve' ? 'resolved' : 'justified', reason));
      console.log(`[review-findings] ${id} -> ${cmd === 'resolve' ? 'resolved' : 'justified'}`);
      return;
    }
    case 'list': {
      if (ledger.length === 0) {
        console.log('[review-findings] ledger empty.');
        return;
      }
      for (const f of ledger)
        console.log(`  ${f.status.padEnd(9)} ${f.severity.padEnd(9)} ${f.id} ${f.title}`);
      return;
    }
    case 'check': {
      if (!existsSync(LEDGER_PATH)) {
        console.error('✗ no findings ledger (.review-findings.json).');
        console.error('  Run battery-synthesis to record the cycle findings, then re-check.');
        process.exit(1);
      }
      const invalid = invalidResolutions(ledger);
      const blocking = blockingFindings(ledger);
      if (invalid.length > 0) {
        console.error(`✗ ${invalid.length} resolved/justified finding(s) missing a reason:`);
        for (const f of invalid) console.error(`  ${f.id} ${f.title}`);
        process.exit(1);
      }
      if (blocking.length > 0) {
        console.error(`✗ ${blocking.length} open Critical/Important finding(s):`);
        for (const f of blocking) console.error(`  ${f.severity} ${f.id} ${f.title}`);
        process.exit(1);
      }
      console.log(
        `[review-findings] all Critical/Important findings resolved or justified (${ledger.length} total).`,
      );
      return;
    }
    default:
      console.error('usage: review-findings <check|add|resolve|justify|list|clear>');
      process.exit(1);
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main(process.argv.slice(2));
