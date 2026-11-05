import { describe, expect, it } from 'vitest';
import { gitLog } from '@/content/git-log';
import { perfReceipts } from '@/content/perf-receipts';
import { profile } from '@/content/profile';
import { projects } from '@/content/projects';
import { personSchema } from '@/content/seo';
import { SITE_LOCALE } from '@/content/site-locale';
import { unknowns } from '@/content/unknowns';
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
      for (const r of perfReceipts[SITE_LOCALE.en]) {
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

    it('keeps the newest git-log entry on the profile current employer', () => {
      expect(
        gitLog[SITE_LOCALE.en][0]?.company,
        'gitLog[SITE_LOCALE.en][0] and profile.currentEmployer drifted: the Current role section would name two employers',
      ).toBe(profile.currentEmployer.name);
    });

    it('contains every project name', () => {
      for (const p of projects[SITE_LOCALE.en]) {
        expect(
          SYSTEM_TEXT,
          `content/projects.ts entry "${p.name}" is missing from SYSTEM: the prompt drifted from the content`,
        ).toContain(p.name);
      }
    });

    it('contains every unknowns[SITE_LOCALE.en].learning claim', () => {
      for (const u of unknowns[SITE_LOCALE.en].learning) {
        expect(
          SYSTEM_TEXT,
          `content/unknowns.ts learning claim "${u.claim.slice(0, 40)}" missing from SYSTEM`,
        ).toContain(u.claim);
      }
    });

    it('contains every unknowns[SITE_LOCALE.en].notSpecializing claim', () => {
      for (const u of unknowns[SITE_LOCALE.en].notSpecializing) {
        expect(
          SYSTEM_TEXT,
          `content/unknowns.ts notSpecializing claim "${u.claim.slice(0, 40)}" missing from SYSTEM`,
        ).toContain(u.claim);
      }
    });
  });

  describe('corpus-critical facts in the narrative (eval fact questions answer from here, not LIVE_DATA)', () => {
    const narrative = SYSTEM_TEXT.slice(0, SYSTEM_TEXT.indexOf('## Performance receipts'));
    const CURRENT_ROLE_WINDOW = /## Current role[\s\S]{0,600}/;

    it('names the GitHub Copilot engineering system at Betsson in the AI stack line', () => {
      expect(narrative).toContain('GitHub Copilot engineering system at Betsson');
      expect(narrative).not.toContain('12-subagent');
    });

    it('carries the 2026-11-03 resume skills lines in the Core stack section', () => {
      expect(narrative).toContain(
        'Frontend: React, Next.js, TypeScript, Angular, TanStack, Plate, Tailwind, Radix, Stencil web components, SSR/SSG/ISR',
      );
      expect(narrative).toContain('Testing: Playwright, Jest, Vitest, MSW, WireMock, Stryker');
      expect(narrative).toContain(
        'AI-native: Vercel AI SDK + AI Gateway, Anthropic API, OpenAI, Google GenAI/Vertex, MCP servers, Zod structured output, eval harnesses with LLM judge calibrated on human labels, per-job cost caps, prompt-injection defense, agent and sub-agent orchestration, Claude Code/Codex skills, spec-driven development, model routing with cost ceilings',
      );
      expect(narrative).not.toContain('Karma');
      expect(narrative).not.toContain('Jasmine');
    });

    it('frames Raylu with the resume wording in the current-role header', () => {
      expect(narrative).not.toMatch(/deal[- ]origination/i);
      expect(
        narrative,
        'the fund-assets framing must sit in the Current role section, not only in the projects list below',
      ).toMatch(/## Current role[\s\S]{0,200}\$500B\+/);
    });

    it('carries the Raylu start date and remote mode inside the Current role section', () => {
      expect(narrative).toMatch(CURRENT_ROLE_WINDOW);
      expect(narrative.match(CURRENT_ROLE_WINDOW)?.[0]).toContain('Jun 2026');
      expect(narrative.match(CURRENT_ROLE_WINDOW)?.[0]).toMatch(/remote/i);
    });

    it('tells the model to decline off-topic trivia instead of answering it', () => {
      expect(narrative).toMatch(/only answer questions about Erik/i);
    });

    it('carries the -32% page-load receipt in the Grupo SBF employment line', () => {
      const sbfLine = narrative.split('\n').find((line) => line.startsWith('- Grupo SBF'));
      expect(sbfLine, 'Grupo SBF employment line missing from narrative').toBeDefined();
      expect(sbfLine).toContain('-32%');
      expect(sbfLine).toContain('10%');
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
