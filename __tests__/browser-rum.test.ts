// __tests__/browser-rum.test.ts
// Behavioral test (CG3): verifies the Vercel RUM wiring by EXERCISING it.
//
//  - RootLayout is rendered with VERCEL=1 and VERCEL unset; the gated
//    <Analytics/> + <SpeedInsights/> fragment must appear only on Vercel.
//  - proxy() is invoked and the actual Content-Security-Policy header it
//    emits must allow the two Vercel ingest origins in connect-src — without
//    that, the RUM beacons are blocked at runtime.
//
// The package.json dependency assertion is a genuine config read (the only
// behavior-free check here) and carries a behavioral-test-allow tag.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Render Analytics/SpeedInsights as identifiable inert markers so the gated
// fragment is observable in the rendered element tree.
vi.mock('@vercel/analytics/next', () => ({
  Analytics: () => null,
}));
vi.mock('@vercel/speed-insights/next', () => ({
  SpeedInsights: () => null,
}));

// next/font/local runs inside the Next build pipeline only — stub it so the
// layout module can be imported under vitest.
vi.mock('next/font/local', () => ({
  default: () => ({ variable: 'mock-font', className: 'mock-font', style: {} }),
}));

// next/script — render as a passthrough so RootLayout can construct.
vi.mock('next/script', () => ({
  default: () => null,
}));

// Walk the rendered React element tree and collect the display names of every
// component-type node. This surfaces the gated <Analytics/> / <SpeedInsights/>
// without needing a full DOM render of the <html> document.
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
