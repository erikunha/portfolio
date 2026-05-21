// __tests__/system-prompt.test.ts
// Behavioral tests for lib/ask/system-prompt.ts.
//
// Two invariants matter for the audit Theme 7 fix to actually work:
//
//   1. SYSTEM_TEXT must be ≥ ~3500 characters → ≥ ~1024 tokens (English
//      averages ~3.5 chars/token for the Anthropic tokenizer). If SYSTEM
//      falls below the Haiku ephemeral cache minimum, the cache_control
//      directive matches nothing and per-call input billing stays at
//      full price (the silently-broken state the audit found).
//
//   2. SYSTEM must contain live data from content/*.ts so it drifts
//      automatically when those files change. Each appended content
//      file is asserted via a unique fingerprint that should survive
//      cosmetic edits.
//
// See docs/audit/2026-05-19-principal-audit.md Theme 7 + Debate 5 +
// Standard 7 (AI features are measured, not asserted).

import { describe, expect, it } from 'vitest';
import { perfReceipts } from '@/content/perf-receipts';
import { projects } from '@/content/projects';
import { unknowns } from '@/content/unknowns';
import { visaRows } from '@/content/visa';
import { SYSTEM, SYSTEM_TEXT } from '@/lib/ask/system-prompt';

// 3500 chars is a conservative proxy for 1024 tokens at the typical
// 3.5-chars/token English ratio. The actual minimum Anthropic enforces is
// 1024 tokens; this length check is the cheap CI-side guard that catches
// regressions BEFORE a deploy makes the cache silently miss.
const CACHE_ELIGIBILITY_MIN_CHARS = 3500;

describe('lib/ask/system-prompt', () => {
  describe('cache eligibility (audit Theme 7)', () => {
    it('SYSTEM_TEXT is ≥ 3500 chars (proxy for ≥ 1024 tokens, Haiku ephemeral cache minimum)', () => {
      expect(SYSTEM_TEXT.length).toBeGreaterThanOrEqual(CACHE_ELIGIBILITY_MIN_CHARS);
    });

    it('the SYSTEM block declares cache_control: ephemeral', () => {
      expect(SYSTEM).toHaveLength(1);
      const block = SYSTEM[0];
      expect(block?.type).toBe('text');
      expect(block?.cache_control).toEqual({ type: 'ephemeral' });
    });

    it('SYSTEM block text matches SYSTEM_TEXT', () => {
      expect(SYSTEM[0]?.text).toBe(SYSTEM_TEXT);
    });
  });

  describe('privacy (audit CG5)', () => {
    it('does not embed a personal phone number in the SYSTEM prompt', () => {
      // /api/ask's SYSTEM prompt is reachable on a publicly fetchable
      // surface — a personal WhatsApp number must not be part of it.
      // A phone number is a `+`-prefixed international number or a digit
      // run of 9+ digits (the BR mobile shape). `YYYY-YYYY` date ranges
      // and per-employer year spans in the résumé narrative are not.
      expect(SYSTEM_TEXT).not.toMatch(/\+\d[\d\s()-]{6,}\d/);
      expect(SYSTEM_TEXT).not.toMatch(/(?:\d[\s()-]?){9,}\d/);
      expect(SYSTEM_TEXT).not.toContain('99839-4086');
      expect(SYSTEM_TEXT).not.toMatch(/WhatsApp/i);
    });
  });

  describe('content drift detection (single source of truth)', () => {
    it('contains every perf-receipt metric and delta', () => {
      for (const r of perfReceipts) {
        expect(
          SYSTEM_TEXT,
          `perf-receipts.ts entry "${r.metric}" missing from SYSTEM — drift detected`,
        ).toContain(r.metric);
        expect(
          SYSTEM_TEXT,
          `perf-receipts.ts delta "${r.delta}" missing from SYSTEM — drift detected`,
        ).toContain(r.delta);
      }
    });

    it('contains every project name', () => {
      for (const p of projects) {
        expect(
          SYSTEM_TEXT,
          `projects.ts entry "${p.name}" missing from SYSTEM — drift detected`,
        ).toContain(p.name);
      }
    });

    it('contains every visa jurisdiction and status', () => {
      for (const v of visaRows) {
        expect(
          SYSTEM_TEXT,
          `visa.ts jurisdiction "${v.jurisdiction}" missing from SYSTEM`,
        ).toContain(v.jurisdiction);
        expect(SYSTEM_TEXT, `visa.ts status "${v.status}" missing from SYSTEM`).toContain(v.status);
      }
    });

    it('contains every unknowns.learning claim', () => {
      for (const u of unknowns.learning) {
        expect(
          SYSTEM_TEXT,
          `unknowns.ts learning claim "${u.claim.slice(0, 40)}" missing from SYSTEM`,
        ).toContain(u.claim);
      }
    });

    it('contains every unknowns.notSpecializing claim', () => {
      for (const u of unknowns.notSpecializing) {
        expect(
          SYSTEM_TEXT,
          `unknowns.ts notSpecializing claim "${u.claim.slice(0, 40)}" missing from SYSTEM`,
        ).toContain(u.claim);
      }
    });
  });

  describe('narrative integrity', () => {
    it('keeps the identity anchor lines (hand-edited persona)', () => {
      expect(SYSTEM_TEXT).toContain('AI proxy on Erik Cunha');
      expect(SYSTEM_TEXT).toContain('## Identity');
      expect(SYSTEM_TEXT).toContain('## Core stack');
      expect(SYSTEM_TEXT).toContain('## Targeting');
    });

    it('keeps the closing safety/style instructions', () => {
      expect(SYSTEM_TEXT).toContain('Be direct and honest');
      expect(SYSTEM_TEXT).toContain('Do not fabricate');
      expect(SYSTEM_TEXT).toMatch(/under 200 words/);
    });

    it('points the model at the receipts section as the authoritative metric source', () => {
      expect(SYSTEM_TEXT).toMatch(/Performance receipts/i);
      expect(SYSTEM_TEXT).toMatch(/authoritative/i);
    });
  });
});
