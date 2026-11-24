import { describe, expect, it } from 'vitest';
import { VITALS_WEEK_MAX_RECORDS, weekCapWarning } from '@/lib/vitals/store';

describe('weekCapWarning', () => {
  it('warns when the week list is at the cap', () => {
    expect(weekCapWarning(VITALS_WEEK_MAX_RECORDS)).toContain('6000');
  });

  it('stays silent below the cap', () => {
    expect(weekCapWarning(VITALS_WEEK_MAX_RECORDS - 1)).toBeUndefined();
  });
});
