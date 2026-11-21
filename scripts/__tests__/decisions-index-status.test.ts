import { describe, expect, it } from 'vitest';
import { parseDecisions } from '../codegen/decisions-index';

const bullet = (body: string) => `- **2026-11-18** · **Title.** ${body}\n`;

describe('decision status detection', () => {
  it('keeps a bullet active when it mentions the word in prose', () => {
    const [entry] = parseDecisions(
      bullet('The `Superseded` marker sets the status; a superseded plan is listed.'),
    );
    expect(entry?.status).toBe('active');
  });

  it('marks a bullet superseded for each real marker form', () => {
    const forms = [
      '**Superseded (2026-11-13):** moved.',
      'Superseded 2026-11-08 by pnpm.',
      '_Superseded by the 2026-11-07 entry._',
      '(Superseded the same day: removed.)',
    ];
    for (const form of forms) {
      const [entry] = parseDecisions(bullet(form));
      expect(entry?.status, form).toBe('superseded');
    }
  });

  it('marks a partial marker as partly superseded', () => {
    const [entry] = parseDecisions(bullet('_Superseded in part by the 2026-11-10 entry._'));
    expect(entry?.status).toBe('partly superseded');
  });
});
