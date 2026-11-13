import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { askFacts } from '@/content/ask-facts';
import { gitLog } from '@/content/git-log';
import { perfReceipts } from '@/content/perf-receipts';
import { profile } from '@/content/profile';
import { projects } from '@/content/projects';
import { personSchema } from '@/content/seo';
import { SITE_LOCALE } from '@/content/site-locale';
import { unknowns } from '@/content/unknowns';
import { isCacheEligible } from '@/lib/ask/cache-eligibility';
import { ASK_ANSWER_WORDS, ASK_LONG_ANSWER_WORDS, ASK_MAX_OUTPUT_TOKENS } from '@/lib/ask/limits';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';

const BASELINE_PATH = '__tests__/fixtures/system-prompt.baseline.txt';
const COUNTRY_AND_AREA_CODE_LENGTH = 4;
const PHONE_LOCAL_DIGITS = personSchema.telephone
  .replace(/\D/g, '')
  .slice(COUNTRY_AND_AREA_CODE_LENGTH);

describe('lib/ask/system-prompt', () => {
  describe('cache eligibility', () => {
    it('SYSTEM_TEXT clears the Haiku 5.5 minimum cacheable prefix by the conservative token bound', () => {
      expect(isCacheEligible(SYSTEM_TEXT)).toBe(true);
    });
  });

  describe('prompt bytes', () => {
    it('composes the same bytes as the prompt that held these facts as literals', () => {
      // behavioral-test-allow: the fixture is the byte-for-byte prompt the model is served
      const baseline = readFileSync(join(process.cwd(), BASELINE_PATH), 'utf8');
      expect(
        SYSTEM_TEXT,
        'SYSTEM_TEXT drifted from __tests__/fixtures/system-prompt.baseline.txt. A deliberate prompt or content edit regenerates the fixture from SYSTEM_TEXT in the same commit; an unintended diff changes the prompt cache key and model behaviour.',
      ).toBe(baseline);
    });

    it('composes every ask fact from content/ask-facts.ts', () => {
      for (const line of [
        askFacts.openTo,
        ...askFacts.coreStack,
        ...askFacts.currentRoleScope,
        ...askFacts.currentRoleDetail,
        ...askFacts.targeting,
        ...askFacts.workingStyle,
        ...askFacts.opinions,
        ...askFacts.calibration,
        ...askFacts.community,
        ...askFacts.projectDetail,
      ]) {
        expect(SYSTEM_TEXT, line).toContain(line);
      }
      for (const decision of askFacts.decisions) {
        expect(SYSTEM_TEXT, decision.decision).toContain(decision.decision);
        expect(SYSTEM_TEXT, decision.rejected).toContain(decision.rejected);
      }
      for (const story of askFacts.stories) {
        expect(SYSTEM_TEXT, story.title).toContain(story.text);
      }
    });
  });

  describe('privacy', () => {
    it('does not embed a personal phone number in the SYSTEM prompt', () => {
      expect(SYSTEM_TEXT).not.toMatch(/\+\d[\d\s()-]{6,}\d/);
      expect(SYSTEM_TEXT).not.toMatch(/(?:\d[\s()-]?){9,}\d/);

      const digitsOnly = SYSTEM_TEXT.normalize('NFKC').replace(/[^\p{Nd}]/gu, '');
      expect(
        digitsOnly,
        `the owner's real phone number must never appear in the SYSTEM prompt in ANY formatting. Two things this guard learned the hard way: (1) it used to pin a LITERAL ('99839-4086'), which went stale the moment the number changed and left the live one unguarded, it now derives from personSchema.telephone; (2) it used to strip a separator ALLOWLIST ([\\s()+.-]), which an en-dash or a zero-width space walked straight through. Deleting every non-digit after NFKC leaves no allowlist to go stale.`,
      ).not.toContain(PHONE_LOCAL_DIGITS);

      expect(SYSTEM_TEXT).not.toMatch(/WhatsApp/i);
    });
  });

  describe('content drift detection (single source of truth)', () => {
    it('contains every perf-receipt metric and delta', () => {
      for (const r of perfReceipts[SITE_LOCALE.en]) {
        expect(
          SYSTEM_TEXT,
          `perf-receipts.ts entry "${r.metric}" missing from SYSTEM, drift detected`,
        ).toContain(r.metric);
        expect(
          SYSTEM_TEXT,
          `perf-receipts.ts delta "${r.delta}" missing from SYSTEM, drift detected`,
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

    it('carries the resume skills lines in the Core stack section', () => {
      expect(narrative).toContain(
        'Frontend: React, Next.js, TypeScript, Angular, TanStack, Plate, Tailwind, Radix, Stencil web components, SSR/SSG/ISR',
      );
      expect(narrative).toContain('Testing: Playwright, Jest, Vitest, MSW, WireMock, Stryker');
      expect(narrative).toContain(
        'AI-native: Vercel AI SDK + AI Gateway, Anthropic API, OpenAI, Google GenAI/Vertex, MCP servers, Zod structured output, eval harnesses with LLM judge calibrated on human labels, per-job cost caps, prompt-injection defense, agent and sub-agent orchestration, Claude Code/Codex skills, spec-driven development, model routing with cost ceilings',
      );
      expect(narrative).toContain('Karma and Jasmine');
    });

    it('frames Raylu with the resume wording in the current-role header', () => {
      expect(
        narrative,
        'the AI deal origination framing and the fund-assets figure must sit in the Current role header, not only in the projects list below',
      ).toMatch(/## Current role[\s\S]{0,200}deal origination[\s\S]{0,200}\$500B\+/);
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

    it('caps a request for everything at a word count that fits the output token limit', () => {
      const WORST_CASE_TOKENS_PER_WORD = 2;
      expect(SYSTEM_TEXT).toContain(`under ${ASK_ANSWER_WORDS} words`);
      expect(SYSTEM_TEXT).toContain(`stay within ${ASK_LONG_ANSWER_WORDS} words`);
      expect(
        ASK_LONG_ANSWER_WORDS * WORST_CASE_TOKENS_PER_WORD,
        'an instruction that allows more words than the output cap lets the route cut the answer mid-content, which the output-validation eval reads as corruption',
      ).toBeLessThan(ASK_MAX_OUTPUT_TOKENS);
    });

    it('does not let an unbounded detail request run past the length limit', () => {
      expect(SYSTEM_TEXT).not.toMatch(/unless the question demands more detail/);
    });

    it('states where Erik lives and labels an employer location as the company base', () => {
      expect(
        SYSTEM_TEXT,
        'without the label the model reads the employer city on the current role as where Erik lives',
      ).toContain(`Lives in ${profile.country} (${profile.timezone})`);
      for (const entry of gitLog[SITE_LOCALE.en]) {
        expect(SYSTEM_TEXT, entry.company).toContain(`Employer location: ${entry.location}`);
      }
    });

    it('keeps the working-style section apart from the work arrangement', () => {
      expect(
        SYSTEM_TEXT,
        'a section titled "How Erik works" answers "how does he prefer to work" with method and drops the remote, hybrid or on-site scope',
      ).not.toContain('## How Erik works');
      expect(SYSTEM_TEXT).toMatch(/## Working style \(.*arrangement.*under Identity\)/);
      expect(SYSTEM_TEXT).toContain(askFacts.openTo);
    });

    it('points the model at the receipts section as the authoritative metric source', () => {
      expect(SYSTEM_TEXT).toMatch(/Performance receipts/i);
      expect(SYSTEM_TEXT).toMatch(/authoritative/i);
    });
  });
});
