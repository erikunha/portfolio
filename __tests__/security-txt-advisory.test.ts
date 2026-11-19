import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseSecurityTxt } from '@/lib/security-txt';

const SHIPPED_FILE = path.resolve(__dirname, '../public/.well-known/security.txt');
const ADVISORY_URL = 'https://github.com/erikunha/portfolio/security/advisories/new';

describe('security.txt private reporting channel', () => {
  it('lists the GitHub private advisory form as a Contact beside email', () => {
    const report = parseSecurityTxt(readFileSync(SHIPPED_FILE, 'utf8'), new Date());
    expect(report.fields.Contact, 'private vulnerability reporting is enabled').toContain(
      ADVISORY_URL,
    );
  });
});
