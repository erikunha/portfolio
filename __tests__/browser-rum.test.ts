// behavior-free check here) and carries a behavioral-test-allow tag.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vercel/analytics/next', () => ({
  Analytics: () => null,
}));
vi.mock('@vercel/speed-insights/next', () => ({
  SpeedInsights: () => null,
}));

vi.mock('next/font/local', () => ({
  default: () => ({ variable: 'mock-font', className: 'mock-font', style: {} }),
}));

vi.mock('next/script', () => ({
  default: () => null,
}));

function componentNames(node: unknown, acc: string[] = []): string[] {
  if (!node || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    for (const child of node) componentNames(child, acc);
    return acc;
  }
  const el = node as { type?: unknown; props?: { children?: unknown } };
  if (typeof el.type === 'function') {
    const fn = el.type as { name?: string; displayName?: string };
    acc.push(fn.displayName ?? fn.name ?? 'anonymous');
  }
  if (el.props && 'children' in el.props) componentNames(el.props.children, acc);
  return acc;
}

describe('browser RUM (Vercel Analytics + Speed Insights)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('declares @vercel/analytics and @vercel/speed-insights as runtime deps', () => {
    // behavioral-test-allow: reads package.json to assert installed deps, not source structure
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8')) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.['@vercel/analytics']).toBeDefined();
    expect(pkg.dependencies?.['@vercel/speed-insights']).toBeDefined();
  });

  it('mounts Analytics + SpeedInsights when VERCEL=1', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.resetModules();
    const { default: RootLayout } = await import('@/app/layout');
    const tree = RootLayout({ children: null });
    const names = componentNames(tree);
    expect(names).toContain('Analytics');
    expect(names).toContain('SpeedInsights');
  });

  it('omits the RUM components when VERCEL is unset', async () => {
    vi.stubEnv('VERCEL', '');
    vi.resetModules();
    const { default: RootLayout } = await import('@/app/layout');
    const tree = RootLayout({ children: null });
    const names = componentNames(tree);
    expect(names).not.toContain('Analytics');
    expect(names).not.toContain('SpeedInsights');
  });

  it('proxy CSP connect-src allows the two Vercel ingest origins', async () => {
    vi.resetModules();
    const { proxy } = await import('@/proxy');
    const res = proxy(new NextRequest('https://erikunha.dev/', { method: 'GET' }));
    const csp = res.headers.get('content-security-policy') ?? '';
    const connectSrc = csp.split(';').find((d) => d.trim().startsWith('connect-src')) ?? '';
    expect(connectSrc).toContain('https://vitals.vercel-insights.com');
    expect(connectSrc).toContain('https://va.vercel-scripts.com');
  });
});
