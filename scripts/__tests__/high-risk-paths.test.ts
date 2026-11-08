import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HIGH_RISK_FILES,
  HIGH_RISK_PREFIXES,
  highRiskFiles,
  isHighRisk,
  parseFileList,
} from '../high-risk-paths';

const ROOT = process.cwd();
const SCRIPT = join(ROOT, 'scripts', 'high-risk-paths.ts');

describe('isHighRisk', () => {
  it.each([
    'app/api/ask/route.ts',
    'app/api/contact/route.ts',
    'lib/rate-limit.ts',
    'proxy.ts',
    'lib/env.ts',
    'lib/server/read-body.ts',
    'lib/ask/system-prompt.ts',
    'lib/ask/injection.ts',
    'lib/ask/output-guard.ts',
    'lib/agent/mcp-tools.ts',
    '.github/workflows/ci.yml',
    '.github/workflows/high-risk-label.yml',
    'next.config.ts',
    'vercel.json',
    'package.json',
    'pnpm-lock.yaml',
    '.env.example',
    '.gitleaks.toml',
    '.husky/pre-push',
  ])('flags %s', (file) => {
    expect(isHighRisk([file])).toBe(true);
  });

  it.each([
    'components/Hero/Hero.tsx',
    'app/page.tsx',
    'app/css/theme.css',
    'content/profile.ts',
    'docs/07-workflows.md',
    'README.md',
    'lib/time.ts',
    'tests/e2e/contact.spec.ts',
    '__tests__/contact-route.test.ts',
    '.github/pull_request_template.md',
  ])('does not flag %s', (file) => {
    expect(isHighRisk([file])).toBe(false);
  });

  it('is false for an empty change set', () => {
    expect(isHighRisk([])).toBe(false);
  });

  it('is true when one file among many is high-risk', () => {
    expect(isHighRisk(['README.md', 'components/Hero/Hero.tsx', 'proxy.ts'])).toBe(true);
  });

  it('does not match a sibling that only shares a name prefix with a listed file', () => {
    expect(isHighRisk(['lib/env.ts.bak'])).toBe(false);
    expect(isHighRisk(['proxy.tsx'])).toBe(false);
    expect(isHighRisk(['package.json.md'])).toBe(false);
  });

  it('does not match a directory that only shares a name prefix with a listed directory', () => {
    expect(isHighRisk(['app/api-docs/page.tsx'])).toBe(false);
    expect(isHighRisk(['lib/asking/x.ts'])).toBe(false);
  });

  it('does not match a listed file name nested under another directory', () => {
    expect(isHighRisk(['docs/package.json'])).toBe(false);
    expect(isHighRisk(['components/proxy.ts'])).toBe(false);
  });
});

describe('highRiskFiles', () => {
  it('returns only the matching files, in input order', () => {
    expect(
      highRiskFiles(['README.md', 'app/api/ask/route.ts', 'components/A.tsx', 'package.json']),
    ).toEqual(['app/api/ask/route.ts', 'package.json']);
  });
});

describe('parseFileList', () => {
  it('splits lines, trims them and drops blanks', () => {
    expect(parseFileList('proxy.ts\n\n  lib/env.ts  \r\nREADME.md\n')).toEqual([
      'proxy.ts',
      'lib/env.ts',
      'README.md',
    ]);
  });
});

describe('the path list', () => {
  it('has no entry that points at nothing, so a rename cannot silently drop a surface', () => {
    const orphaned = [...HIGH_RISK_PREFIXES, ...HIGH_RISK_FILES].filter(
      (entry) => !existsSync(join(ROOT, entry)),
    );
    expect(orphaned).toEqual([]);
  });

  it('writes every directory entry with a trailing slash and no file entry with one', () => {
    expect(HIGH_RISK_PREFIXES.filter((entry) => !entry.endsWith('/'))).toEqual([]);
    expect(HIGH_RISK_FILES.filter((entry) => entry.endsWith('/'))).toEqual([]);
  });

  it('lists the surfaces CLAUDE.md and the API boundary rules name as high-risk', () => {
    expect(HIGH_RISK_PREFIXES).toEqual(
      expect.arrayContaining(['app/api/', '.github/workflows/', 'lib/server/', 'lib/ask/']),
    );
    expect(HIGH_RISK_FILES).toEqual(
      expect.arrayContaining([
        'lib/rate-limit.ts',
        'proxy.ts',
        'lib/env.ts',
        'next.config.ts',
        'package.json',
        'pnpm-lock.yaml',
      ]),
    );
  });
});

describe('the command line', () => {
  const run = (stdin: string) =>
    execFileSync('node', [SCRIPT], { input: stdin, encoding: 'utf8' }).split('\n').filter(Boolean);

  it('prints the high-risk files from a file list on stdin', () => {
    expect(run('README.md\nproxy.ts\ncomponents/A.tsx\napp/api/ask/route.ts\n')).toEqual([
      'proxy.ts',
      'app/api/ask/route.ts',
    ]);
  });

  it('prints nothing when no file is high-risk', () => {
    expect(run('README.md\ncomponents/A.tsx\n')).toEqual([]);
  });

  it('prints nothing for empty input', () => {
    expect(run('')).toEqual([]);
  });
});
