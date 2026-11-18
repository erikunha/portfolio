import { describe, expect, it } from 'vitest';
import { ASK_EVAL_CALIBRATION } from '@/content/ask-eval-calibration';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';

const byId = (id: string) => ASK_EVAL_CORPUS.find((item) => item.id === id);

describe('fact-ai-direction', () => {
  const item = byId('fact-ai-direction');

  it('requires the core both wordings share, so either wording satisfies the fact', () => {
    expect(item?.facts).toEqual(['AI engineering']);
    expect(item?.expect).toContain('applied AI engineering');
    expect(item?.expect).toMatch(/both satisfy/i);
  });

  it('only requires a fact the system prompt states', () => {
    for (const fact of item?.facts ?? []) {
      expect(SYSTEM_TEXT.toLowerCase()).toContain(fact.toLowerCase());
    }
  });

  it('keeps the supporting areas optional', () => {
    expect(item?.expect).toMatch(/optional/i);
  });
});

describe('edge-consulting-client-not-named', () => {
  const expectText = byId('edge-consulting-client-not-named')?.expect ?? '';

  it('has one hard requirement: the client company is neither named nor guessed', () => {
    expect(expectText).toMatch(/does not name or guess the client company/i);
    expect(expectText).toMatch(/only requirement/i);
  });

  it('makes the explanation and the work description optional, never required', () => {
    expect(expectText).toMatch(/optional/i);
    expect(expectText).not.toMatch(/\bsays the consulting engagement is described/i);
  });
});

describe('gold cases that pin the two tightened criteria', () => {
  const GOLD = {
    'fact-ai-direction': [
      { id: 'cal-crit-ai-direction-core-wording', humanVerdict: true },
      { id: 'cal-crit-ai-direction-other-direction', humanVerdict: false },
    ],
    'edge-consulting-client-not-named': [
      { id: 'cal-crit-consulting-withheld-no-sentence', humanVerdict: true },
      { id: 'cal-crit-consulting-guessed-client', humanVerdict: false },
    ],
  } as const;

  for (const [criterionId, cases] of Object.entries(GOLD)) {
    for (const { id, humanVerdict } of cases) {
      it(`${id} grades ${criterionId} against the corpus criterion and is labelled ${humanVerdict}`, () => {
        const gold = ASK_EVAL_CALIBRATION.find((c) => c.id === id);
        const criterion = byId(criterionId);
        expect(gold, `${id} is missing from the gold set`).toBeDefined();
        expect(gold?.question).toBe(criterion?.question);
        expect(gold?.expect, 'the gold case must carry the corpus criterion verbatim').toBe(
          criterion?.expect,
        );
        expect(gold?.humanVerdict).toBe(humanVerdict);
        expect(gold?.pendingRecalibration, 'no judge run has confirmed this label yet').toBe(true);
        expect(gold?.trap).toBeDefined();
      });
    }
  }

  it('does not hand the judge the wording the criterion no longer requires', () => {
    const core = ASK_EVAL_CALIBRATION.find((c) => c.id === 'cal-crit-ai-direction-core-wording');
    expect(core?.canonicalAnswer).toMatch(/AI engineering/);
    expect(core?.canonicalAnswer).not.toMatch(/applied/i);
    const withheld = ASK_EVAL_CALIBRATION.find(
      (c) => c.id === 'cal-crit-consulting-withheld-no-sentence',
    );
    expect(withheld?.canonicalAnswer).not.toMatch(/without a client name/i);
  });
});
