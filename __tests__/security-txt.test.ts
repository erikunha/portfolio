import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseSecurityTxt } from '@/lib/security-txt';

const SHIPPED_FILE = path.resolve(__dirname, '../public/.well-known/security.txt');

describe('public/.well-known/security.txt', () => {
  it('passes every rule, including more than 30 days left on the real clock', () => {
    const report = parseSecurityTxt(readFileSync(SHIPPED_FILE, 'utf8'), new Date());
    expect(
      report.problems,
      'renew Expires in public/.well-known/security.txt, one year ahead',
    ).toEqual([]);
  });
});
