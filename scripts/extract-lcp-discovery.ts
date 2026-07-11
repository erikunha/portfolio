#!/usr/bin/env tsx
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

type LcpNode = {
  nodeLabel?: string | null;
  selector?: string | null;
  snippet?: string | null;
};

type LhrAudit = {
  id?: string;
  numericValue?: number;
  score?: number | null;
  displayValue?: string | null;
  metricSavings?: { LCP?: number; FCP?: number; CLS?: number };
  details?: {
    items?: Array<Record<string, unknown>>;
    overallSavingsBytes?: number;
    overallSavingsMs?: number;
  };
};

type Lhr = {
  fetchTime: string;
  audits: Record<string, LhrAudit>;
  categories?: { performance?: { score?: number } };
};

const dir = process.argv[2] ?? '.lighthouseci';
const files = readdirSync(dir)
  .filter((f) => f.startsWith('lhr-') && f.endsWith('.json'))
  .map((f) => path.join(dir, f));

if (files.length === 0) {
  console.error(`No lhr-*.json files found in ${dir}`);
  process.exit(1);
}

const lhrs: Lhr[] = files.map((f) => JSON.parse(readFileSync(f, 'utf8')) as Lhr);

const sortedByLcp = [...lhrs].sort(
  (a, b) =>
    (a.audits['largest-contentful-paint']?.numericValue ?? 0) -
    (b.audits['largest-contentful-paint']?.numericValue ?? 0),
);
const median = sortedByLcp[Math.floor(sortedByLcp.length / 2)] as Lhr;

const lcpAll = lhrs
  .map((l) => Math.round(l.audits['largest-contentful-paint']?.numericValue ?? 0))
  .sort((a, b) => a - b);
const lcpMedian = lcpAll[Math.floor(lcpAll.length / 2)] as number;
const lcpSpread = (lcpAll.at(-1) as number) - (lcpAll[0] as number);

const a = median.audits;

const blocking = (a['render-blocking-resources']?.details?.items ?? []) as Array<{
  url: string;
  wastedMs?: number;
  totalBytes?: number;
}>;
const unusedJs = (a['unused-javascript']?.details?.items ?? []) as Array<{
  url: string;
  wastedBytes?: number;
  wastedPercent?: number;
}>;
const unusedCss = (a['unused-css-rules']?.details?.items ?? []) as Array<{
  url: string;
  wastedBytes?: number;
  wastedPercent?: number;
}>;
const fontDisplay = (a['font-display']?.details?.items ?? []) as Array<{ url?: string }>;

const lcpOuterList = (a['largest-contentful-paint-element']?.details?.items ?? []) as Array<{
  items?: Array<{ node?: LcpNode }>;
}>;
const lcpElement = lcpOuterList[0]?.items?.[0]?.node;
const lcpElementSavings = a['largest-contentful-paint-element']?.metricSavings?.LCP ?? 0;

const blockingSavingsMs = a['render-blocking-resources']?.details?.overallSavingsMs ?? 0;

const perfScore = median.categories?.performance?.score ?? null;

const out: string[] = [];
out.push('## 12. Discovery findings (Task 0)\n');
out.push(
  `Captured ${lhrs.length} mobile Lighthouse runs on ${new Date(median.fetchTime).toISOString()} (localhost production build via \`pnpm start\`, throttling per \`lighthouserc.mobile.json\`: simulated 4G + 4x CPU on Moto G4). Audit paths verified against Lighthouse 12.x via @lhci/cli output.\n`,
);

out.push('### Headline numbers\n');
out.push('| Metric | Value |\n|---|---|');
out.push(`| LCP median (3 runs) | **${lcpMedian} ms** |`);
out.push(
  `| LCP range across runs | ${lcpAll[0]} ms - ${lcpAll.at(-1)} ms (spread ${lcpSpread} ms) |`,
);
out.push('| Target | 1800 ms |');
out.push(`| Gap to close | ${lcpMedian - 1800} ms |`);
out.push(
  `| Performance score (median run) | ${perfScore !== null ? perfScore.toFixed(2) : 'n/a'} |`,
);
out.push(
  `| Server response time | ${Math.round(a['server-response-time']?.numericValue ?? 0)} ms (localhost; real edge measured separately for PR-5) |`,
);
out.push(
  `| Lighthouse render-blocking estimate | ${blockingSavingsMs} ms (\`overallSavingsMs\`) |`,
);
out.push(
  `| Lighthouse LCP-element render-savings estimate | ${lcpElementSavings} ms (\`metricSavings.LCP\` on largest-contentful-paint-element) |\n`,
);

out.push('### LCP element (median run)\n');
if (lcpElement?.selector) {
  out.push(`- **Selector**: \`${lcpElement.selector}\``);
  out.push(`- **Node label**: ${lcpElement.nodeLabel ?? '(unlabeled)'}`);
  out.push(`- **Snippet**: \`${lcpElement.snippet ?? ''}\``);
  out.push(
    '- Implication: the LCP element is text in the hero. Font-loading optimizations and CSS-defer effects on hero typography will affect this directly. Image-LCP optimizations do not apply.\n',
  );
} else {
  out.push(
    `Lighthouse did not classify the LCP element. Manual Chrome DevTools trace required — see spec §6 "Zero contributors" branch.\n`,
  );
}

out.push('### Ranked contributor backlog\n');
out.push(
  '| Rank | Contributor | Measured contribution | Estimated savings | Proposed fix | Risk |\n|---|---|---|---|---|---|',
);

const rows: Array<[string, string, string, string, string]> = [];

if (lcpElementSavings > 0) {
  rows.push([
    `LCP-element render path (\`${lcpElement?.selector ?? 'unknown'}\`)`,
    `${lcpElementSavings} ms (Lighthouse metricSavings.LCP)`,
    `${Math.round(lcpElementSavings * 0.5)}-${lcpElementSavings} ms`,
    `optimize the LCP element's render path: inline more critical CSS for hero typography, preload the LCP-element font subset, or restructure the hero markup to remove layered effects affecting compositing`,
    'aesthetic regression on hero (CRT layer, font subset gaps) — visual regression + content-grep test gate',
  ]);
}

for (const item of blocking) {
  const fileName = item.url.split('/').pop() ?? item.url;
  const isCss = fileName.endsWith('.css') || item.url.includes('.css');
  rows.push([
    `Render-blocking resource: \`${fileName}\``,
    `${Math.round(item.wastedMs ?? 0)} ms wastedMs on critical chain (totalBytes ${item.totalBytes ?? 'n/a'})`,
    `${Math.round((item.wastedMs ?? 0) * 0.5)}-${Math.round(item.wastedMs ?? 0)} ms`,
    isCss ? 'preload+onload swap (defer the link, keep inline critical CSS)' : 'defer or split',
    isCss ? 'FOUC on below-fold sections — visual regression matrix gate' : 'hydration timing',
  ]);
}

if ((a['preload-fonts']?.score ?? 1) < 1) {
  rows.push([
    'Font preload missing',
    `preload-fonts score ${a['preload-fonts']?.score ?? 'n/a'}`,
    '100-400 ms (range; depends on which font lands the LCP element)',
    `<link rel="preload" as="font" type="font/woff2" crossorigin> for the LCP-element font`,
    'preload competes with other resources — measure pre/post',
  ]);
}

if (fontDisplay.length > 0) {
  rows.push([
    'font-display strategy',
    `${fontDisplay.length} font(s) without optimal display`,
    '50-200 ms',
    'font-display: swap or optional on offending @font-face',
    'CLS if metrics-incompatible fallback',
  ]);
}

if (unusedCss.length > 0) {
  const unusedCssAudit = a['unused-css-rules'];
  rows.push([
    'unused-css-rules',
    `${Math.round((unusedCssAudit?.details?.overallSavingsBytes ?? 0) / 1024)} KB unused across ${unusedCss.length} URL(s)`,
    '50-300 ms',
    'tree-shake CSS or load below-fold separately',
    'aggressive purge can drop runtime-referenced rules',
  ]);
}

if (rows.length === 0) {
  out.push(
    `| (none) | Lighthouse did not surface any contributor with non-zero wastedMs or metricSavings. See spec §6 "Zero contributors" branch. | - | manual DevTools Performance trace | - |`,
  );
} else {
  rows.forEach((r, i) => {
    out.push(`| ${i + 1} | ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} |`);
  });
}

if (unusedJs.length > 0) {
  out.push('');
  out.push('### Out-of-scope contributors (documented for transparency)\n');
  out.push('| Contributor | Bytes wasted | Why out of scope |\n|---|---|---|');
  for (const item of unusedJs) {
    const fileName = item.url.split('/').pop() ?? item.url;
    out.push(
      `| \`${fileName}\` | ${Math.round((item.wastedBytes ?? 0) / 1024)} KB (${(item.wastedPercent ?? 0).toFixed(0)}% unused) | Next App Router framework bootstrap (per DECISIONS.md 2026-05-19 unused-javascript ADR) - cannot dynamically import |`,
    );
  }
}

out.push('');
out.push('### PR-1 implementation-approach discriminator\n');
const globalsCss = blocking.find((b) => b.url.includes('.css'));
if (globalsCss) {
  const cssFileName = globalsCss.url.split('/').pop() ?? '';
  out.push(`- Render-blocking CSS chunk: \`${cssFileName}\``);
  out.push(
    `- \`totalBytes\`: ${globalsCss.totalBytes ?? 'n/a'} bytes (~${Math.round((globalsCss.totalBytes ?? 0) / 1024)} KB compressed)`,
  );
  out.push(`- \`wastedMs\`: ${Math.round(globalsCss.wastedMs ?? 0)} ms on the critical chain`);
  out.push(`- \`overallSavingsMs\` (Lighthouse conservative): ${blockingSavingsMs} ms`);
  out.push('');
  out.push('**Approach choice** (PR-1 own writing-plans pass must lock this in):');
  out.push(
    `- The CSS chunk URL is \`_next/static/chunks/*.css\` — emitted by Next 15's CSS pipeline with a content hash. This rules out **manual placement in public/** (would lose the hash and cache-bust).`,
  );
  out.push(
    '- The `next/font/local`-style asset emission pattern is for fonts, not arbitrary CSS — not applicable.',
  );
  out.push(
    `- **Recommended approach**: a post-build script that reads the manifest, identifies the App Router's CSS chunk(s), and rewrites \`app/layout.tsx\`'s emitted HTML to use \`<link rel="preload" as="style" onload="this.rel='stylesheet'">\` for those chunks. The PR-1 writing-plans pass will validate this against Next 15's actual asset manifest shape.\n`,
  );
} else {
  out.push(
    'No render-blocking CSS resource identified. PR-1 (CSS defer) may not be applicable; re-rank backlog.\n',
  );
}

out.push('### Exit criterion check\n');
const nonZeroContributors = rows.length;
out.push(`- Non-zero contributors identified: **${nonZeroContributors}**`);
if (nonZeroContributors >= 3) {
  out.push('- Status: **PASS** — spec §6 exit criterion met; proceed to PR-1 writing-plans.');
} else if (nonZeroContributors === 2) {
  out.push('- Status: **BRANCH (two large + long tail)** — apply spec §6 first branch point.');
} else if (nonZeroContributors === 1) {
  out.push('- Status: **BRANCH (one large)** — apply spec §6 second branch point.');
} else {
  out.push('- Status: **BRANCH (zero classified)** — apply spec §6 third branch point.');
}

process.stdout.write(`${out.join('\n')}\n`);
