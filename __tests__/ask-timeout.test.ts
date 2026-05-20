// __tests__/ask-timeout.test.ts
// Source-grep test: verifies explicit upstream timeouts on Anthropic
// (/api/ask) and Resend (/api/contact). See spec docs/superpowers/
// specs/2026-05-18-gates-and-harness-hardening-design.md §5.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ASK_SOURCE = readFileSync(path.resolve(__dirname, '../app/api/ask/route.ts'), 'utf-8');
const CONTACT_SOURCE = readFileSync(
  path.resolve(__dirname, '../app/api/contact/route.ts'),
  'utf-8',
);

describe('upstream timeouts', () => {
  describe('/api/ask Anthropic SDK init', () => {
    it('passes explicit timeout: 30_000 to the Anthropic constructor', () => {
      expect(ASK_SOURCE).toMatch(/new Anthropic\(\s*\{\s*timeout:\s*30_000/);
    });

    it('does NOT set maxRetries: 0 (keeps SDK default of 2 retries)', () => {
      expect(ASK_SOURCE).not.toMatch(/maxRetries:\s*0\b/);
    });
  });

  describe('/api/contact Resend send', () => {
    it('wraps the Resend send in a Promise.race against a 10_000 ms timer', () => {
      // PR 5c of audit roadmap extracted the literal to a named constant:
      // `const RESEND_TIMEOUT_MS = 10_000`. Accept either the literal or
      // the constant in the setTimeout call, but the constant declaration
      // (which fixes the value at 10_000) must still be present.
      expect(CONTACT_SOURCE).toMatch(/Promise\.race/);
      expect(CONTACT_SOURCE).toMatch(/setTimeout\(\s*[^,]+,\s*(?:10_000|RESEND_TIMEOUT_MS)\b/);
      expect(CONTACT_SOURCE).toMatch(/RESEND_TIMEOUT_MS\s*=\s*10_000\b/);
    });

    it('still preserves the existing graceful-fail logging on error', () => {
      // PR #11 migrated console.error to log.error (pino facade). Accept either
      // the original bracketed console pattern or the structured log.error form.
      const hasConsolePattern = /\[contact\] resend unavailable/.test(CONTACT_SOURCE);
      const hasLogPattern = /log\.error\(\s*'Resend unavailable'/.test(CONTACT_SOURCE);
      expect(hasConsolePattern || hasLogPattern).toBe(true);
    });
  });
});
