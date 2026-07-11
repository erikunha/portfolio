import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ci = readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8');

const heading = '\n  performance:';
const start = ci.indexOf(heading);
const rest = ci.slice(start + heading.length);
const nextJobRel = rest.search(/\n {2}\S/);
const job =
  nextJobRel === -1 ? ci.slice(start) : ci.slice(start, start + heading.length + nextJobRel);

describe('ci.yml performance job — LHCI GitHub status', () => {
  it('defines a performance job', () => {
    expect(ci).toMatch(/^\s{2}performance:/m);
    expect(job).not.toBe('');
  });

  it('grants statuses: write so LHCI can post the Lighthouse CI commit status', () => {
    expect(job).toMatch(/statuses:\s*write/);
  });

  it('passes the built-in token as LHCI_GITHUB_TOKEN (basic-status path, no extra secret)', () => {
    expect(job).toMatch(/LHCI_GITHUB_TOKEN:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/);
  });

  it('pins the build hash to the PR HEAD so statuses land on the PR commit, not the merge SHA', () => {
    expect(job).toMatch(
      /LHCI_BUILD_CONTEXT__CURRENT_HASH:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha\s*\}\}/,
    );
  });
});
