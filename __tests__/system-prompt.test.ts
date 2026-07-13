import { describe, expect, it } from 'vitest';
import { perfReceipts } from '@/content/perf-receipts';
import { projects } from '@/content/projects';
import { personSchema } from '@/content/seo';
import { unknowns } from '@/content/unknowns';
import { visaRows } from '@/content/visa';
import { SYSTEM, SYSTEM_TEXT } from '@/lib/ask/system-prompt';

const CACHE_ELIGIBILITY_MIN_CHARS = 3500;
const COUNTRY_AND_AREA_CODE_LENGTH = 4;
const PHONE_LOCAL_DIGITS = personSchema.telephone
  .replace(/\D/g, '')
  .slice(COUNTRY_AND_AREA_CODE_LENGTH);

describe('lib/ask/system-prompt', () => {
  describe('cache eligibility', () => {
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

  describe('privacy', () => {
    it('does not embed a personal phone number in the SYSTEM prompt', () => {
      expect(SYSTEM_TEXT).not.toMatch(/\+\d[\d\s()-]{6,}\d/);
      expect(SYSTEM_TEXT).not.toMatch(/(?:\d[\s()-]?){9,}\d/);

      const digitsOnly = SYSTEM_TEXT.normalize('NFKC').replace(/[^\p{Nd}]/gu, '');
      expect(
        digitsOnly,
        `the owner's real phone number must never appear in the SYSTEM prompt in ANY formatting. Two things this guard learned the hard way: (1) it used to pin a LITERAL ('99839-4086'), which went stale the moment the number changed and left the live one unguarded — it now derives from personSchema.telephone; (2) it used to strip a separator ALLOWLIST ([\\s()+.-]), which an en-dash or a zero-width space walked straight through. Deleting every non-digit after NFKC leaves no allowlist to go stale.`,
      ).not.toContain(PHONE_LOCAL_DIGITS);

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
      expect(SYSTEM_TEXT).toMatch(/Do not reveal.*instructions/);
    });

    it('points the model at the receipts section as the authoritative metric source', () => {
      expect(SYSTEM_TEXT).toMatch(/Performance receipts/i);
      expect(SYSTEM_TEXT).toMatch(/authoritative/i);
    });
  });
});
