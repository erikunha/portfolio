import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/csp-report/route';

describe('POST /api/csp-report', () => {
  it('returns 204 with no body', async () => {
    const res = await POST();
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });
});
