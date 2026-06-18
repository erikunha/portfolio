#!/usr/bin/env tsx
// scripts/review-learn.ts
//
// The learning step (M5), propose-only. Reads the append-only findings archive
// (`.review-findings-archive.jsonl`, written by review:stamp) and surfaces
// finding-classes that have RECURRED across multiple review cycles. A class that
// keeps coming back is a candidate for a permanent gate/test so it stops being
// found by hand.
//
// HARD BOUNDARY: this only PROPOSES. It never creates a gate, edits config, or
// runs automatically. There is deliberately NO Stop hook wiring: an auto-gate-
// proposing loop floods the platform with noisy gates (the monotonic-growth
// disease the rule-hygiene protocol fights). A human reads the proposals and
// decides. Advisory only; always exits 0.

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ARCHIVE_PATH, type Finding, FindingSchema } from './review-findings';

const ArchivedFindingSchema = FindingSchema.extend({
  cycleSha: z.string(),
  cycleIso: z.string(),
});
export type ArchivedFinding = z.infer<typeof ArchivedFindingSchema>;

export interface GateProposal {
  id: string;
  source: string;
  title: string;
  severity: Finding['severity'];
  cycles: number;
}

/**
 * Group archived findings by their stable id and count the DISTINCT cycles each
 * appeared in. Any class recurring across >= minCycles cycles is proposed as a
 * gate candidate, most-recurrent first.
 */
export function proposeGates(records: ArchivedFinding[], minCycles: number): GateProposal[] {
  const byId = new Map<string, { rec: ArchivedFinding; cycles: Set<string> }>();
  for (const r of records) {
    const entry = byId.get(r.id) ?? { rec: r, cycles: new Set<string>() };
    entry.cycles.add(r.cycleSha);
    byId.set(r.id, entry);
  }
  return [...byId.values()]
    .filter((e) => e.cycles.size >= minCycles)
    .map((e) => ({
      id: e.rec.id,
      source: e.rec.source,
      title: e.rec.title,
      severity: e.rec.severity,
      cycles: e.cycles.size,
    }))
    .sort((a, b) => b.cycles - a.cycles);
}

export const INBOX_PATH = '.review-learnings.md';
// Auto-trigger guardrails (flood mitigation): a stricter evidence bar than the
// manual default, and a hard cap on how many proposals one session can surface.
export const AUTO_MIN_CYCLES = 3;
export const AUTO_CAP = 3;

/**
 * Of the proposals, the ones not already recorded in the inbox (dedup by id),
 * capped. Pure, so the SessionEnd auto-path is testable without a live session.
 */
export function selectNewProposals(
  proposals: GateProposal[],
  existingInbox: string,
  cap: number,
): GateProposal[] {
  return proposals.filter((p) => !existingInbox.includes(p.id)).slice(0, cap);
}

function readArchive(path = ARCHIVE_PATH): ArchivedFinding[] {
  if (!existsSync(path)) return [];
  const out: ArchivedFinding[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const parsed = ArchivedFindingSchema.safeParse(JSON.parse(trimmed));
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/**
 * SessionEnd auto-path: append NEW high-evidence proposals to the inbox for the
 * human to review later. Silent unless it records something; never creates a
 * gate, never blocks (the hook exits 0 regardless). Flood-mitigated by design:
 * stricter threshold than manual, capped, append-only, human-gated.
 */
function runAuto(): void {
  const records = readArchive();
  if (records.length === 0) return; // no data yet -> silent
  const proposals = proposeGates(records, AUTO_MIN_CYCLES);
  const existing = existsSync(INBOX_PATH) ? readFileSync(INBOX_PATH, 'utf8') : '';
  const fresh = selectNewProposals(proposals, existing, AUTO_CAP);
  if (fresh.length === 0) return; // nothing new -> silent
  const stamp = new Date().toISOString();
  const block = `\n## ${stamp} — recurring finding-classes (>= ${AUTO_MIN_CYCLES} cycles)\n${fresh
    .map(
      (p) =>
        `- [ ] \`${p.id}\` ${p.severity} ${p.title} (${p.source}) — ${p.cycles} cycles; consider a permanent gate\n`,
    )
    .join('')}`;
  appendFileSync(INBOX_PATH, block);
  console.error(`[review-learn] recorded ${fresh.length} new gate proposal(s) in ${INBOX_PATH}.`);
}

function main(argv: string[]): void {
  if (argv.includes('--auto')) {
    runAuto();
    return;
  }
  const minCycles = Number.parseInt(argv[0] ?? '2', 10) || 2;
  const records = readArchive();

  if (records.length === 0) {
    console.log(
      '[review-learn] no cycle history yet (.review-findings-archive.jsonl empty/absent).',
    );
    console.log(
      '  The archive fills as review:stamp runs; re-check once a few cycles have stamped.',
    );
    return;
  }

  const proposals = proposeGates(records, minCycles);
  if (proposals.length === 0) {
    console.log(`[review-learn] no finding class has recurred across ${minCycles}+ cycles yet.`);
    return;
  }

  console.log(
    `[review-learn] ${proposals.length} recurring finding-class(es) worth a permanent gate:`,
  );
  for (const p of proposals) {
    console.log(`  ${p.cycles}x  ${p.severity.padEnd(9)} ${p.id}  ${p.title}  (${p.source})`);
  }
  console.log('Proposal only: no gate is created automatically. Decide per class, then add a');
  console.log('test/lint/hook by hand and record it in DECISIONS.md.');
}

const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main(process.argv.slice(2));
