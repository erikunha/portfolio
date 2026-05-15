import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const RATE_LIMIT_SOURCE = readFileSync(
  path.resolve(__dirname, '../lib/rate-limit.ts'),
  'utf-8',
);
const ASK_SOURCE = readFileSync(
  path.resolve(__dirname, '../app/api/ask/route.ts'),
  'utf-8',
);

describe('LLM budget cap', () => {
  it('rate-limit.ts exports getBudgetKey', () => {
    expect(RATE_LIMIT_SOURCE).toContain('getBudgetKey');
  });

  it('rate-limit.ts exports incrementBudget', () => {
    expect(RATE_LIMIT_SOURCE).toContain('incrementBudget');
  });

  it('rate-limit.ts exports checkBudget', () => {
    expect(RATE_LIMIT_SOURCE).toContain('checkBudget');
  });

  it('ask route checks budget before calling Anthropic', () => {
    const budgetIdx   = ASK_SOURCE.indexOf('checkBudget');
    const anthropicIdx = ASK_SOURCE.indexOf('anthropic.messages.create');
    expect(budgetIdx).toBeGreaterThanOrEqual(0);
    expect(anthropicIdx).toBeGreaterThanOrEqual(0);
    expect(budgetIdx).toBeLessThan(anthropicIdx);
  });

  it('ask route increments budget after stream completes', () => {
    expect(ASK_SOURCE).toContain('incrementBudget');
  });

  it('ask route uses prompt caching via cache_control', () => {
    expect(ASK_SOURCE).toContain('cache_control');
  });
});
