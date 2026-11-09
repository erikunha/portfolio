import { describe, expect, it } from 'vitest';
import { AGENT_EVAL_REDIS_KEY } from '@/scripts/agent-eval';

const ASK_EVAL_REDIS_KEY = 'ask:eval:latest';

describe('agent-eval Redis key isolation', () => {
  it("pins the agent-eval key to 'agent-eval:latest'", () => {
    expect(AGENT_EVAL_REDIS_KEY).toBe('agent-eval:latest');
  });

  it('never collides with the ask:eval key', () => {
    expect(AGENT_EVAL_REDIS_KEY).not.toBe(ASK_EVAL_REDIS_KEY);
  });
});
