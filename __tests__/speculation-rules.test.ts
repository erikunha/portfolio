import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import nextConfig from '@/next.config';

const RULES_PATH = '/speculation-rules.json';
const RULES_CONTENT_TYPE = 'application/speculationrules+json';
const HEADER_NAME = 'speculation-rules';
const PAGE_ROUTES = [
  '/',
  '/cv',
  '/summary',
  '/links',
  '/links/en',
  '/pt',
  '/pt/cv',
  '/pt/summary',
  '/design-system',
  '/design-system/tokens',
];
const NON_PAGE_PATHS = [
  '/api/ask',
  '/api/healthz',
  '/_next/static/chunks/app.js',
  '/erik-cunha-cv.pdf',
  '/erik-cunha-cv-pt.pdf',
  '/llms.txt',
  '/favicon.ico',
];

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

async function headerRules(): Promise<HeaderRule[]> {
  return (await nextConfig.headers?.()) ?? [];
}

function headersFor(rules: HeaderRule[], path: string): Map<string, string> {
  const merged = new Map<string, string>();
  for (const rule of rules) {
    if (!new RegExp(`^${rule.source}$`).test(path)) continue;
    for (const { key, value } of rule.headers) merged.set(key.toLowerCase(), value);
  }
  return merged;
}

function rulesFile(): { prefetch: Record<string, unknown>[] } & Record<string, unknown> {
  return JSON.parse(readFileSync(join(process.cwd(), 'public', RULES_PATH), 'utf8'));
}

type Predicate =
  | { and: Predicate[] }
  | { not: Predicate }
  | { href_matches: string }
  | { selector_matches: string };

function pathMatches(pattern: string, path: string): boolean {
  const source = pattern.replaceAll('.', String.raw`\.`).replaceAll('*', '.*');
  return new RegExp(`^${source}$`).test(path);
}

function admits(predicate: Predicate, path: string): boolean {
  if ('and' in predicate) return predicate.and.every((part) => admits(part, path));
  if ('not' in predicate) {
    return 'selector_matches' in predicate.not ? true : !admits(predicate.not, path);
  }
  if ('href_matches' in predicate) return pathMatches(predicate.href_matches, path);
  return true;
}

describe('speculation rules', () => {
  it('points every page route at the rules file', async () => {
    const rules = await headerRules();
    for (const path of PAGE_ROUTES) {
      expect(headersFor(rules, path).get(HEADER_NAME), path).toBe(`"${RULES_PATH}"`);
    }
  });

  it('leaves the API, framework assets and files without the header', async () => {
    const rules = await headerRules();
    for (const path of NON_PAGE_PATHS) {
      expect(headersFor(rules, path).get(HEADER_NAME), path).toBeUndefined();
    }
  });

  it('serves the rules file as speculationrules+json with a revalidation window', async () => {
    const served = headersFor(await headerRules(), RULES_PATH);
    expect(served.get('content-type')).toBe(RULES_CONTENT_TYPE);
    expect(served.get('cache-control')).toMatch(/^public, max-age=\d+$/);
  });

  it('keeps the strict security headers on the rules file and on page routes', async () => {
    const rules = await headerRules();
    for (const path of [RULES_PATH, '/cv']) {
      const served = headersFor(rules, path);
      expect(served.get('content-security-policy'), path).toContain("script-src 'self'");
      expect(served.get('x-content-type-options'), path).toBe('nosniff');
    }
  });

  it('is valid JSON that prefetches at moderate eagerness and never prerenders', () => {
    const parsed = rulesFile();
    expect(Object.keys(parsed)).toEqual(['prefetch']);
    expect(parsed.prefetch).toHaveLength(1);
    expect(parsed.prefetch[0]).toMatchObject({ eagerness: 'moderate' });
    expect(parsed.prefetch[0]).toHaveProperty('where');
    expect(parsed.prefetch[0]).not.toHaveProperty('urls');
  });

  it('admits page paths and refuses the API, PDFs and other files by path', () => {
    const { where } = rulesFile().prefetch[0] as { where: Predicate };
    for (const path of PAGE_ROUTES) expect(admits(where, path), path).toBe(true);
    for (const path of NON_PAGE_PATHS) expect(admits(where, path), path).toBe(false);
  });
});
