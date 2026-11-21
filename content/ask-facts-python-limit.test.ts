import { describe, expect, it } from 'vitest';
import { askFacts } from './ask-facts';

describe('the production Python limit in content/ask-facts', () => {
  const limit = askFacts.calibration.find((line) =>
    line.startsWith('No production Python service'),
  );

  it('names the backend frameworks he did ship, so an answer about Python does not invent one', () => {
    expect(limit, 'the Python limit is missing from the calibration facts').toBeDefined();
    expect(limit).toContain('Express');
    expect(limit).toContain('Fastify');
  });

  it('rules NestJS out in the same line that invites a list of Node backends', () => {
    expect(limit).toContain('never NestJS');
  });
});
