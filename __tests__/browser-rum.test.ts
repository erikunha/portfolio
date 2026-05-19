// __tests__/browser-rum.test.ts
// Source-grep test: verifies Vercel Analytics + Speed Insights are mounted in
// app/layout.tsx and that CSP allows their ingest origins. See spec
// docs/superpowers/specs/2026-05-18-production-observability-design.md §5.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LAYOUT_SOURCE = readFileSync(path.resolve(__dirname, '../app/layout.tsx'), 'utf-8');
const PACKAGE_JSON = JSON.parse(
  readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'),
) as { dependencies?: Record<string, string> };
const PROXY_SOURCE = readFileSync(path.resolve(__dirname, '../proxy.ts'), 'utf-8');

describe('browser RUM (Vercel Analytics + Speed Insights)', () => {
  it('declares @vercel/analytics and @vercel/speed-insights as runtime deps', () => {
    expect(PACKAGE_JSON.dependencies?.['@vercel/analytics']).toBeDefined();
    expect(PACKAGE_JSON.dependencies?.['@vercel/speed-insights']).toBeDefined();
  });

  it('imports Analytics from @vercel/analytics/next in layout.tsx', () => {
    expect(LAYOUT_SOURCE).toMatch(
      /import\s*\{\s*Analytics\s*\}\s*from\s*['"]@vercel\/analytics\/next['"]/,
    );
  });

  it('imports SpeedInsights from @vercel/speed-insights/next in layout.tsx', () => {
    expect(LAYOUT_SOURCE).toMatch(
      /import\s*\{\s*SpeedInsights\s*\}\s*from\s*['"]@vercel\/speed-insights\/next['"]/,
    );
  });

  it('mounts both Analytics and SpeedInsights inside <body>', () => {
    // Tightened to enforce position-within-body: both mounts must appear
    // between the opening <body> tag and the closing </body> tag.
    expect(LAYOUT_SOURCE).toMatch(/<body[\s\S]*<Analytics\s*\/>[\s\S]*<\/body>/);
    expect(LAYOUT_SOURCE).toMatch(/<body[\s\S]*<SpeedInsights\s*\/>[\s\S]*<\/body>/);
  });

  it('proxy.ts CSP connect-src includes the two Vercel ingest origins', () => {
    expect(PROXY_SOURCE).toMatch(/connect-src[^"]*https:\/\/vitals\.vercel-insights\.com/);
    expect(PROXY_SOURCE).toMatch(/connect-src[^"]*https:\/\/va\.vercel-scripts\.com/);
  });
});
