import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('semgrep fixtures + vendored rules', () => {
  it('vulnerable fixture contains an injection sink and a hardcoded secret', () => {
    const src = readFileSync(`${root}/tests/fixtures/semgrep/vulnerable.ts`, 'utf8');
    // injection sink: user input flows into a child_process exec
    expect(src).toMatch(/exec\(/);
    // hardcoded secret marker the secrets ruleset keys on
    expect(src).toMatch(/sk_test_/);
  });

  it('clean fixture has no injection sink and no hardcoded secret', () => {
    const src = readFileSync(`${root}/tests/fixtures/semgrep/clean.ts`, 'utf8');
    expect(src).not.toMatch(/sk_test_/);
    expect(src).not.toMatch(/exec\(/);
  });

  it('vendored OWASP + secrets rules are present and non-empty YAML', () => {
    for (const f of ['.semgrep/owasp-top-ten.yml', '.semgrep/secrets.yml']) {
      expect(existsSync(`${root}/${f}`)).toBe(true);
      expect(readFileSync(`${root}/${f}`, 'utf8')).toMatch(/^rules:/m);
    }
  });

  it('.semgrepignore excludes the fixtures directory from the real scan', () => {
    const ignore = readFileSync(`${root}/.semgrepignore`, 'utf8');
    expect(ignore).toMatch(/tests\/fixtures\//);
  });
});
