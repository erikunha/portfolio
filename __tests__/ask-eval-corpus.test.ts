import { describe, expect, it, vi } from 'vitest';
import {
  ASK_EVAL_CORPUS,
  AskEvalCorpusSchema,
  type AskEvalItem,
  MAX_CRITERION_FACTS,
} from '@/content/ask-eval-corpus';
import { gitLog } from '@/content/git-log';
import { profile, profileStack } from '@/content/profile';
import { SITE_LOCALE } from '@/content/site-locale';
import { WORK_SCOPE_SENTENCE } from '@/content/work-scope';
import { INJECTION_RE, isInjectionAttempt, normalizeInjectionInput } from '@/lib/ask/injection';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';

describe('content/ask-eval-corpus', () => {
  it('parses its own Zod schema', () => {
    expect(() => AskEvalCorpusSchema.parse(ASK_EVAL_CORPUS)).not.toThrow();
  });

  it('has >= 20 non-jailbreak items (factual + edge)', () => {
    const nonJailbreak = ASK_EVAL_CORPUS.filter((i: AskEvalItem) => i.kind !== 'jailbreak');
    expect(nonJailbreak.length).toBeGreaterThanOrEqual(20);
  });

  it('has >= 5 jailbreak items', () => {
    const jailbreak = ASK_EVAL_CORPUS.filter((i: AskEvalItem) => i.kind === 'jailbreak');
    expect(jailbreak.length).toBeGreaterThanOrEqual(5);
  });

  it('has >= 2 output-validation items', () => {
    const outputValidation = ASK_EVAL_CORPUS.filter(
      (i: AskEvalItem) => i.kind === 'output-validation',
    );
    expect(outputValidation.length).toBeGreaterThanOrEqual(2);
  });

  it('has >= 3 pt-BR items, including a jailbreak the injection gate does not catch', () => {
    const pt = ASK_EVAL_CORPUS.filter((i: AskEvalItem) => i.locale === 'pt');
    expect(pt.length).toBeGreaterThanOrEqual(3);
    const modelGradedJailbreaks = pt.filter(
      (i) => i.kind === 'jailbreak' && !isInjectionAttempt(i.question),
    );
    expect(
      modelGradedJailbreaks.length,
      'a pt-BR jailbreak the regex refuses is graded by the gate, so it never measures the Portuguese model path',
    ).toBeGreaterThanOrEqual(1);
  });

  it('keeps ordinary questions that mention an injection phrase out of the injection gate', () => {
    const mentions = ASK_EVAL_CORPUS.filter((i) => i.id.includes('injection-phrase-mentioned'));
    expect(mentions.length).toBeGreaterThanOrEqual(2);
    for (const item of mentions) {
      expect(isInjectionAttempt(item.question), `item "${item.id}" would 400 at the gate`).toBe(
        false,
      );
    }
  });

  it('every id is unique', () => {
    const ids = ASK_EVAL_CORPUS.map((i: AskEvalItem) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every item has a non-empty question and expect description', () => {
    for (const item of ASK_EVAL_CORPUS) {
      expect(
        item.question.trim().length,
        `item "${item.id}" has an empty question`,
      ).toBeGreaterThan(0);
      expect(item.expect.trim().length, `item "${item.id}" has an empty expect`).toBeGreaterThan(0);
    }
  });

  it('grades no criterion against a work-authorization or citizenship fact', () => {
    for (const item of ASK_EVAL_CORPUS) {
      expect(
        item.expect,
        `item "${item.id}" grades a fact the ask prompt no longer publishes: the judge would score the model against data the site removed`,
      ).not.toMatch(/work authorization|citizen|citizenship/i);
    }
  });

  it('grades no criterion against a Staff or Principal target', () => {
    for (const item of ASK_EVAL_CORPUS) {
      expect(
        item.expect,
        `item "${item.id}" grades a level the owner decision removed`,
      ).not.toMatch(/\bStaff\b|\bPrincipal\b/i);
    }
  });

  it('grounds the base-location criterion in the published system prompt', () => {
    const item = ASK_EVAL_CORPUS.find((i) => i.id === 'fact-base-location');
    expect(item?.expect).toContain(profile.country);
    expect(item?.expect).toContain(profile.timezone);
    expect(SYSTEM_TEXT).toContain(profile.country);
    expect(SYSTEM_TEXT).toContain(profile.timezone);
  });

  it('grounds the work-scope criteria in the published system prompt', () => {
    for (const id of ['fact-work-scope', 'fact-pt-work-scope']) {
      const item = ASK_EVAL_CORPUS.find((i) => i.id === id);
      expect(item?.expect, id).toContain('async-first');
      expect(SYSTEM_TEXT, id).toContain(WORK_SCOPE_SENTENCE);
    }
  });

  it('asks the permit and client questions as probes that a model must not answer with a claim', () => {
    const byId = (id: string) => ASK_EVAL_CORPUS.find((i) => i.id === id);
    for (const id of [
      'edge-visa-sponsorship-not-claimed',
      'edge-relocation-not-claimed',
      'edge-pt-work-permit-not-claimed',
    ]) {
      expect(byId(id)?.expect, id).toMatch(/does not claim/i);
      expect(byId(id)?.kind, id).toBe('edge');
    }
    expect(byId('edge-consulting-client-not-named')?.expect).toMatch(/does not name/i);
    expect(SYSTEM_TEXT, 'the prompt names no client for the consulting role').toContain(
      'Independent Consultant',
    );
  });

  it('grades the targeting criterion against GenAI and agents, not a sector list', () => {
    const item = ASK_EVAL_CORPUS.find((i) => i.id === 'fact-targeting-roles');
    expect(item?.expect).toMatch(/GenAI/);
    expect(item?.expect).toMatch(/agents/);
    expect(item?.expect).not.toMatch(/fintech|healthcare/i);
  });

  it('declares the key facts of every factual criterion', () => {
    const missing = ASK_EVAL_CORPUS.filter(
      (item) => item.kind === 'factual' && (item.facts ?? []).length === 0,
    ).map((item) => item.id);
    expect(
      missing,
      'a factual criterion without declared facts cannot be checked for drift',
    ).toEqual([]);
  });

  it('keeps each criterion to a few key facts, not an exhaustive list', () => {
    for (const item of ASK_EVAL_CORPUS) {
      expect(
        (item.facts ?? []).length,
        `item "${item.id}" requires more than ${MAX_CRITERION_FACTS} facts: the feature answers concisely, so a long list fails on model variance`,
      ).toBeLessThanOrEqual(MAX_CRITERION_FACTS);
    }
  });

  it('states every declared fact in its criterion', () => {
    for (const item of ASK_EVAL_CORPUS) {
      for (const fact of item.facts ?? []) {
        expect(
          item.expect.toLowerCase(),
          `item "${item.id}" declares the fact "${fact}" but its criterion does not ask for it`,
        ).toContain(fact.toLowerCase());
      }
    }
  });

  it('only requires facts the published system prompt states', () => {
    const prompt = SYSTEM_TEXT.toLowerCase();
    for (const item of ASK_EVAL_CORPUS) {
      for (const fact of item.facts ?? []) {
        expect(
          prompt,
          `item "${item.id}" requires "${fact}" but the system prompt does not state it: the model cannot be expected to know it`,
        ).toContain(fact.toLowerCase());
      }
    }
  });

  it('grounds the primary-stack criterion in the profile stack', () => {
    const item = ASK_EVAL_CORPUS.find((i) => i.id === 'fact-primary-stack');
    expect(item?.facts?.length).toBeGreaterThan(0);
    for (const fact of item?.facts ?? []) {
      expect(profileStack.core).toContain(fact);
    }
  });

  it('lets the off-topic criterion accept the redirect the system prompt asks for', () => {
    expect(SYSTEM_TEXT).toContain('offer one related question you can answer');
    for (const id of ['edge-off-topic', 'edge-pt-off-topic']) {
      const item = ASK_EVAL_CORPUS.find((i) => i.id === id);
      expect(item?.expect, `${id} must allow the related-question redirect`).toContain(
        'related question',
      );
      expect(item?.expect, `${id} must not demand brevity beyond the prompt`).not.toMatch(
        /brief|short|only that/i,
      );
    }
  });
});

describe('content/ask-eval-corpus quote-wrapped override jailbreaks', () => {
  const quoted = ASK_EVAL_CORPUS.filter((i) => i.id.startsWith('jb-quoted-override'));

  it('has two English and one pt-BR item', () => {
    expect(quoted.filter((i) => i.locale === undefined).length).toBeGreaterThanOrEqual(2);
    expect(quoted.filter((i) => i.locale === 'pt').length).toBeGreaterThanOrEqual(1);
  });

  it('carries an override phrase the injection gate skips because it sits between quotes', () => {
    for (const item of quoted) {
      expect(item.kind, item.id).toBe('jailbreak');
      expect(
        INJECTION_RE.test(normalizeInjectionInput(item.question)),
        `${item.id} has no phrase`,
      ).toBe(true);
      expect(isInjectionAttempt(item.question), `${item.id} would 400 at the gate`).toBe(false);
    }
  });
});

describe('content/ask-eval-corpus current-role criteria', () => {
  it('state the current start date as optional so a true date never reads as an invented one', () => {
    const [current] = gitLog[SITE_LOCALE.en];
    for (const id of [
      'fact-current-employer',
      'fact-current-role-title',
      'fact-pt-current-employer',
    ]) {
      const item = ASK_EVAL_CORPUS.find((i) => i.id === id);
      expect(item?.expect, id).toContain(current?.date);
    }
  });

  it('ties the injection-phrase answers to Erik own work in either named area', () => {
    for (const id of ['edge-injection-phrase-mentioned', 'edge-pt-injection-phrase-mentioned']) {
      const item = ASK_EVAL_CORPUS.find((i) => i.id === id);
      expect(item?.expect, id).toMatch(/either/i);
      expect(item?.expect, id).toMatch(/prompt-injection defense/);
      expect(item?.expect, id).toMatch(/evaluation harnesses/);
    }
  });

  it('fails at load when the current role has no date', async () => {
    vi.resetModules();
    vi.doMock('@/content/git-log', () => ({ gitLog: { en: [], pt: [] } }));
    await expect(import('@/content/ask-eval-corpus')).rejects.toThrow(/current role date/i);
    vi.doUnmock('@/content/git-log');
    vi.resetModules();
  });
});
