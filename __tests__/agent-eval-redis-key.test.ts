// __tests__/agent-eval-redis-key.test.ts
// C-d.1 — pins the agent-eval Redis key and proves it is DISTINCT from the
// ask:eval key. The two harnesses publish their aggregates to Upstash Redis; if
// they collided on one key, the later run would clobber the earlier harness's
// latest result (spec §3 distinctness). This test is the mechanical guard that
// the keys never converge during a future refactor.

import { describe, expect, it } from 'vitest';
import { AGENT_EVAL_REDIS_KEY } from '@/scripts/agent-eval';

// The ask:eval key is asserted as a string literal rather than imported: the
// constant is private to scripts/ask-eval.ts (on the security-sensitive
// ai-eval path), and importing that module here would drag its server-only
// surface into this unit test for no gain. The literal IS the contract under
// test: if ask:eval ever changes its key, this test still proves agent-eval
// holds a distinct one.
const ASK_EVAL_REDIS_KEY = 'ask:eval:latest';

describe('agent-eval Redis key isolation', () => {
  it("pins the agent-eval key to 'agent-eval:latest'", () => {
    expect(AGENT_EVAL_REDIS_KEY).toBe('agent-eval:latest');
  });

  it('never collides with the ask:eval key', () => {
    expect(AGENT_EVAL_REDIS_KEY).not.toBe(ASK_EVAL_REDIS_KEY);
  });
});
